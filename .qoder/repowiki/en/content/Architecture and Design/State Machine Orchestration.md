# State Machine Orchestration

<cite>
**Referenced Files in This Document**   
- [state.ts](file://src/graph/state.ts)
- [index.ts](file://src/graph/index.ts)
- [input.ts](file://src/graph/nodes/input.ts)
- [enumerate.ts](file://src/graph/nodes/enumerate.ts)
- [analyze.ts](file://src/graph/nodes/analyze.ts)
- [aggregate.ts](file://src/graph/nodes/aggregate.ts)
- [output.ts](file://src/graph/nodes/output.ts)
- [config.ts](file://src/config.ts)
- [auggie-analysis.ts](file://src/tools/auggie-analysis.ts)
- [context-state-manager.ts](file://src/tools/context-state-manager.ts)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [State Model Structure](#state-model-structure)
3. [Reducer Functions and State Updates](#reducer-functions-and-state-updates)
4. [Default Values and Initialization](#default-values-and-initialization)
5. [Immutable Fields and Credentials](#immutable-fields-and-credentials)
6. [Graph Input and Output Interfaces](#graph-input-and-output-interfaces)
7. [State Persistence and Asynchronous Execution](#state-persistence-and-asynchronous-execution)
8. [LangGraph Annotation Pattern Rationale](#langgraph-annotation-pattern-rationale)
9. [State Transformation Examples](#state-transformation-examples)
10. [Class Diagram](#class-diagram)

## Introduction
The SecurityAnalysisState is a comprehensive state management system built on LangGraph's Annotation pattern for orchestrating security analysis workflows. This state machine manages the complete lifecycle of security scans, from initialization through enumeration, analysis, aggregation, and output generation. The state model is designed to track all aspects of a security analysis process including input parameters, scan metadata, analysis progress, findings accumulation, error handling, and output generation. The use of LangGraph's Annotation system enables robust state management across asynchronous node executions, ensuring data consistency and providing a clear audit trail of the analysis process.

## State Model Structure
The SecurityAnalysisState model is structured into several logical sections that represent different phases and aspects of the security analysis workflow. The state begins with input fields that define the scope and parameters of the analysis, including repoPath (the repository to analyze), userQuery (the specific security question or concern), and scopeFilter (optional filtering criteria for the analysis scope).

The state includes comprehensive scan metadata with scanId (a unique identifier generated for each scan), status (tracking the execution state as pending, running, completed, or failed), and timestamps for startedAt and completedAt. These metadata fields provide essential tracking and monitoring capabilities for long-running analysis processes.

For analysis progress tracking, the state maintains targets (the collection of files and code locations identified for analysis), analyzedCategories (the OWASP categories that have been processed), and currentCategory (the category currently being analyzed). The findings accumulation system uses an array of SecurityFinding objects that capture identified vulnerabilities with detailed information including category, severity, evidence location, explanation, and recommended fixes.

Error handling is implemented through an errors array that accumulates error messages throughout the analysis process, allowing for comprehensive error reporting even if the scan completes with issues. The output generation system includes a summary field that contains the final human-readable report of the analysis results.

```mermaid
classDiagram
class SecurityAnalysisState {
+repoPath : string
+userQuery : string
+scopeFilter : string | undefined
+scanId : string
+status : GraphStatus
+startedAt : string | undefined
+completedAt : string | undefined
+targets : AnalysisTarget[]
+analyzedCategories : OwaspCategory[]
+currentCategory : OwaspCategory | undefined
+findings : SecurityFinding[]
+errors : string[]
+summary : string | undefined
+augmentCredentials : AugmentCredentials
}
class SecurityFinding {
+id : string
+category : OwaspCategory
+title : string
+severity : Severity
+evidence : FindingEvidence
+explanation : string
+recommendedFix : string
}
class FindingEvidence {
+file : string
+lineRange : string
+codeSnippet? : string
}
class AnalysisTarget {
+path : string
+type : 'file' | 'route' | 'controller' | 'dependency'
+metadata? : Record<string, string>
}
class AugmentCredentials {
+apiKey : string
+apiUrl : string
}
enum GraphStatus {
pending
running
completed
failed
}
enum Severity {
critical
high
medium
low
info
}
SecurityAnalysisState --> SecurityFinding : "contains"
SecurityAnalysisState --> AnalysisTarget : "contains"
SecurityAnalysisState --> AugmentCredentials : "uses"
SecurityFinding --> FindingEvidence : "contains"
```

**Diagram sources**
- [state.ts](file://src/graph/state.ts#L71-L143)

**Section sources**
- [state.ts](file://src/graph/state.ts#L71-L143)

## Reducer Functions and State Updates
The SecurityAnalysisState employs different reducer strategies for various state fields based on their data types and update requirements. Scalar values such as repoPath, userQuery, scopeFilter, scanId, status, startedAt, completedAt, currentCategory, and summary use overwrite reducers that replace the previous value with the new value. This pattern is appropriate for fields that represent a single state or configuration parameter that should not accumulate over time.

Array fields use concatenation reducers to accumulate data across multiple node executions. The targets field uses a reducer `(prev, next) => [...prev, ...next]` that combines the existing targets with newly discovered targets from the enumeration process. This allows the state to build a comprehensive list of analysis targets as the graph progresses through its nodes.

The findings field uses a similar concatenation reducer to accumulate security findings from multiple analysis operations. This is critical for the security analysis workflow, as different OWASP categories are analyzed in sequence, and each analysis may produce findings that need to be preserved and aggregated in the final report.

The analyzedCategories field uses a deduplicating concatenation reducer `(prev, next) => [...new Set([...prev, ...next])]` that combines existing categories with new ones while ensuring no duplicates. This prevents redundant analysis of the same OWASP category and maintains an accurate record of which categories have been processed.

The errors field uses a simple concatenation reducer to accumulate error messages from various stages of the analysis process. This allows the system to report all encountered issues even if the scan completes successfully, providing comprehensive feedback to the user.

**Section sources**
- [state.ts](file://src/graph/state.ts#L71-L143)

## Default Values and Initialization
The SecurityAnalysisState model includes carefully designed default values for all fields to ensure the state is always in a valid and predictable condition. The repoPath field defaults to './nodejs-goof', providing a sensible default repository path when none is specified by the user. The userQuery field defaults to an empty string, representing an initial state with no specific query.

The scanId field has a dynamic default value that generates a unique identifier using `scan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`. This ensures each scan has a globally unique identifier that can be used for tracking, logging, and result retrieval. The status field defaults to 'pending', representing the initial state before the analysis begins.

Timestamp fields (startedAt and completedAt) default to undefined, indicating that the corresponding events have not yet occurred. This allows the system to accurately track when the analysis actually starts and completes, rather than assuming these values from the beginning.

The targets, findings, and errors arrays all default to empty arrays ([]), providing a clean starting point for accumulating data during the analysis process. The analyzedCategories array also defaults to an empty array, indicating that no OWASP categories have been analyzed yet.

The augmentCredentials field defaults to `{ apiKey: '', apiUrl: '' }`, providing a valid but unauthenticated credential object that will be replaced with actual credentials when the graph is invoked with proper authentication information.

**Section sources**
- [state.ts](file://src/graph/state.ts#L71-L143)

## Immutable Fields and Credentials
The augmentCredentials field is designed to be immutable during the execution of the security analysis graph. While the reducer function allows for the value to be overwritten, the credentials are set at graph invocation and should not change during the analysis process. This immutability ensures consistent authentication throughout the analysis, preventing potential security issues that could arise from changing credentials mid-scan.

The credentials are passed through the GraphInput interface and are validated through the centralized configuration system in config.ts. The AugmentCredentials interface defines the structure as having apiKey and apiUrl properties, which are used to authenticate with the Augment platform for security analysis services.

The immutability of credentials is enforced through the application architecture rather than the state system itself. When the graph is invoked, the credentials are set in the initial state and are then used by various nodes (particularly the analyze node) to authenticate with external services. Since no node in the current implementation updates the augmentCredentials field, it remains constant throughout the execution.

This design choice enhances security by preventing credential tampering during execution and simplifies debugging by ensuring that authentication issues can be traced to the initial configuration rather than potential mid-process changes.

**Section sources**
- [state.ts](file://src/graph/state.ts#L138-L142)
- [config.ts](file://src/config.ts#L127-L152)

## Graph Input and Output Interfaces
The SecurityAnalysisState model defines two key interfaces for interacting with the state machine: GraphInput and GraphOutput. The GraphInput interface specifies the parameters required to initiate a security analysis scan and includes repoPath (optional, with a default value), userQuery (required), scopeFilter (optional), and augmentCredentials (required). This interface represents the entry point for the graph and defines what information must be provided to start an analysis.

The GraphOutput interface defines the structure of the final result returned by the security analysis process. It includes scanId (the unique identifier for the scan), status (the final execution status), findings (the accumulated security findings), summary (the human-readable report), analyzedCategories (the OWASP categories that were processed), errors (any error messages encountered), and optional timestamps for startedAt and completedAt.

These interfaces serve as contracts between the state machine and external systems, ensuring type safety and clear documentation of the expected input and output structures. The GraphInput interface is used when invoking the graph through the runSecurityAnalysis function, while the GraphOutput interface defines the shape of the promise returned by this function.

The separation of input and output interfaces allows for a clean API design where the input focuses on configuration and the output focuses on results and metadata. This separation also enables future extensions to the state model without necessarily changing the external interfaces.

**Section sources**
- [state.ts](file://src/graph/state.ts#L153-L172)

## State Persistence and Asynchronous Execution
The SecurityAnalysisState model is designed to work seamlessly with LangGraph's asynchronous execution model, maintaining state integrity across node boundaries. When the graph executes, each node receives the current state and returns a partial state update, which is then merged into the overall state according to the reducer functions.

The state persistence mechanism ensures that data accumulated in previous nodes remains available to subsequent nodes. For example, the targets identified by the enumerate node are preserved and available to the analyze node, which uses them to focus its analysis. Similarly, findings generated by the analyze node are preserved and available to the aggregate node for report generation.

The use of LangGraph's Annotation system provides automatic state persistence across asynchronous operations, eliminating the need for manual state management or external storage in most cases. However, for long-running analyses or scenarios requiring resumable scans, the system integrates with external state management through tools like context-state-manager.ts, which can save and restore DirectContext state to disk.

The state model's design supports fault tolerance by preserving error information even when the scan completes. This allows users to understand what issues occurred during the analysis process. The status field transitions through states (pending → running → completed/failed) to provide clear execution tracking, while timestamps capture the duration of the analysis.

**Section sources**
- [index.ts](file://src/graph/index.ts#L29-L47)
- [context-state-manager.ts](file://src/tools/context-state-manager.ts)

## LangGraph Annotation Pattern Rationale
The LangGraph Annotation pattern was chosen over plain objects for several compelling reasons that enhance the reliability, observability, and maintainability of the security analysis system. First, the Annotation system provides built-in type safety and validation, ensuring that state updates conform to the defined schema and reducing the risk of runtime errors due to malformed state.

Second, the reducer-based update mechanism enforces consistent state transitions and prevents accidental mutation of the state object. This functional approach to state management makes the system more predictable and easier to reason about, as each state update is an explicit transformation rather than an arbitrary mutation.

Third, the Annotation system integrates seamlessly with LangGraph's execution model, providing automatic state persistence across node boundaries and supporting complex orchestration patterns. This integration enables features like conditional branching, looping, and error handling that would be difficult to implement reliably with plain objects.

Fourth, the Annotation system provides enhanced observability by tracking state changes throughout the execution process. This enables comprehensive logging, monitoring, and debugging capabilities, as the evolution of the state can be traced across the entire analysis workflow.

Finally, the Annotation pattern supports better separation of concerns by clearly defining the state structure and update logic in one place, rather than scattering state management code throughout multiple nodes. This improves code maintainability and makes it easier to extend the state model with new fields or update patterns.

**Section sources**
- [state.ts](file://src/graph/state.ts)
- [index.ts](file://src/graph/index.ts)

## State Transformation Examples
The SecurityAnalysisState undergoes several distinct transformations as it progresses through the graph nodes. When the graph starts, the inputNode initializes the state by setting status to 'running' and startedAt to the current timestamp. This transforms the state from pending to active execution.

The enumerateTargetsNode transforms the state by populating the targets array with AnalysisTarget objects discovered through recursive file system traversal. This operation converts the initial repository path into a structured list of specific files and code locations to analyze, significantly expanding the state's content.

The analyzeNode performs the most complex state transformations, updating both the findings array with newly discovered vulnerabilities and the analyzedCategories array with the OWASP categories that have been processed. Each iteration through the analysis categories adds findings to the existing collection, demonstrating the concatenation reducer in action.

The aggregateNode transforms the raw findings data into a human-readable summary by grouping findings by severity and category, then formatting them into a structured report. This represents a qualitative transformation from structured data to narrative content.

Finally, the outputNode completes the state transformation by setting the status to 'completed' or 'failed' (based on whether errors were encountered) and setting completedAt to the current timestamp. This final transformation marks the completion of the analysis lifecycle and prepares the state for return to the caller.

**Section sources**
- [input.ts](file://src/graph/nodes/input.ts)
- [enumerate.ts](file://src/graph/nodes/enumerate.ts)
- [analyze.ts](file://src/graph/nodes/analyze.ts)
- [aggregate.ts](file://src/graph/nodes/aggregate.ts)
- [output.ts](file://src/graph/nodes/output.ts)

## Class Diagram
The class diagram below illustrates the structure of the SecurityAnalysisState and its related components. The diagram shows the main SecurityAnalysisState class containing all state fields, along with the supporting classes for SecurityFinding, FindingEvidence, AnalysisTarget, and AugmentCredentials. Enumeration types for GraphStatus and Severity are also included to complete the type system.

The relationships between classes are represented through composition and usage associations. SecurityAnalysisState contains arrays of SecurityFinding and AnalysisTarget objects, while SecurityFinding contains a FindingEvidence object. The SecurityAnalysisState uses AugmentCredentials for authentication purposes.

```mermaid
classDiagram
class SecurityAnalysisState {
+repoPath : string
+userQuery : string
+scopeFilter : string | undefined
+scanId : string
+status : GraphStatus
+startedAt : string | undefined
+completedAt : string | undefined
+targets : AnalysisTarget[]
+analyzedCategories : OwaspCategory[]
+currentCategory : OwaspCategory | undefined
+findings : SecurityFinding[]
+errors : string[]
+summary : string | undefined
+augmentCredentials : AugmentCredentials
}
class SecurityFinding {
+id : string
+category : OwaspCategory
+title : string
+severity : Severity
+evidence : FindingEvidence
+explanation : string
+recommendedFix : string
}
class FindingEvidence {
+file : string
+lineRange : string
+codeSnippet? : string
}
class AnalysisTarget {
+path : string
+type : 'file' | 'route' | 'controller' | 'dependency'
+metadata? : Record<string, string>
}
class AugmentCredentials {
+apiKey : string
+apiUrl : string
}
enum GraphStatus {
pending
running
completed
failed
}
enum Severity {
critical
high
medium
low
info
}
SecurityAnalysisState --> SecurityFinding : "contains"
SecurityAnalysisState --> AnalysisTarget : "contains"
SecurityAnalysisState --> AugmentCredentials : "uses"
SecurityFinding --> FindingEvidence : "contains"
```

**Diagram sources**
- [state.ts](file://src/graph/state.ts#L71-L143)