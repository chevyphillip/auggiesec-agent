# Security Profiles

<cite>
**Referenced Files in This Document**   
- [security-config.ts](file://src/tools/security-config.ts)
- [config.ts](file://src/config.ts)
- [index.ts](file://index.ts)
- [.env.example](file://.env.example)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Security Profile Levels](#security-profile-levels)
3. [Configuration Impact on Analysis Rigor](#configuration-impact-on-analysis-rigor)
4. [Security Profile Configuration Examples](#security-profile-configuration-examples)
5. [Trade-offs Between Thoroughness and Performance](#trade-offs-between-thoroughness-and-performance)
6. [Guidance for Organizational Security Requirements](#guidance-for-organizational-security-requirements)

## Introduction
The AuggieSec Agent implements configurable security profiles to control the sensitivity and rigor of security analysis operations. These profiles determine which tools are excluded during vulnerability scanning, ensuring read-only operations and preventing unintended modifications to the codebase. The system provides three distinct security levels—strict, moderate, and permissive—each offering different trade-offs between security enforcement and operational flexibility. Configuration options such as LLM model selection and workspace root definition further influence the depth and scope of analysis, enabling tailored security postures for various use cases from CI/CD pipelines to local development environments.

## Security Profile Levels

The security configuration system defines three profile levels that control tool availability during security scans:

- **Strict Profile**: This is the default and most secure setting, which disables all file modification, process execution, and task modification tools. It ensures complete read-only operation by excluding tools like `save-file`, `str-replace-editor`, `remove-files`, `launch-process`, `kill-process`, `write-process`, `add_tasks`, `update_tasks`, and `reorganize_tasklist`. This profile is recommended for production environments and automated security scanning where no modifications should occur.

- **Moderate Profile**: This balanced setting disables file modification and process execution tools while allowing task management operations. By excluding `save-file`, `str-replace-editor`, `remove-files`, `launch-process`, `kill-process`, and `write-process` but permitting task modification tools, this profile maintains security while allowing workflow adjustments during analysis.

- **Permissive Profile**: This least restrictive setting only disables file modification tools (`save-file`, `str-replace-editor`, `remove-files`), allowing both process execution and task modification operations. This profile is suitable for development and debugging scenarios where additional functionality is required, though it reduces the security guarantees of the analysis process.

The `createSecurityConfig` function validates that critical security tools are properly excluded and provides a human-readable description of the security measures in place for each profile.

**Section sources**
- [security-config.ts](file://src/tools/security-config.ts#L32-L179)

## Configuration Impact on Analysis Rigor

### LLM Configuration Impact
The LLM configuration settings significantly influence the depth and thoroughness of AI-powered analysis. The `ANTHROPIC_API_KEY` environment variable is required for LLM-based analysis, enabling the system to leverage Anthropic's Claude models for vulnerability detection. The `LLM_MODEL` setting determines which specific model version is used for analysis, with the default being `claude-sonnet-4-5-20250929`. Different model versions offer varying capabilities in terms of context window size, reasoning ability, and security analysis precision, directly affecting the comprehensiveness of findings.

The LLM provider is configurable through the `LLM_PROVIDER` environment variable, currently supporting 'anthropic' and 'openai' options. The choice of provider and model impacts both the quality of analysis and associated costs, with more advanced models typically providing deeper insights but requiring more computational resources and time.

### Workspace Scope Configuration
The `WORKSPACE_ROOT` setting controls the scope of the security scan by defining the target repository path for analysis. By default set to `./nodejs-goof`, this configuration parameter determines which codebase will be examined for vulnerabilities. The scope can be adjusted to analyze specific subdirectories or different projects entirely, allowing for targeted security assessments of particular components or services.

This setting directly influences the breadth of the analysis, with broader scopes potentially uncovering more vulnerabilities but requiring longer execution times and more computational resources. Narrower scopes enable faster, more focused analysis of critical components, making them suitable for incremental scanning in development workflows.

**Section sources**
- [config.ts](file://src/config.ts#L71-L78)
- [.env.example](file://.env.example#L21-L28)

## Security Profile Configuration Examples

### CI/CD Pipeline Configuration
For automated security scanning in CI/CD pipelines, a strict security profile is recommended to ensure read-only operations and prevent any accidental modifications to the codebase:

```env
# CI/CD Pipeline Configuration
WORKSPACE_ROOT=./src
LLM_MODEL=claude-opus-4-5-20251101
SECURITY_PROFILE=strict
```

This configuration uses a powerful LLM model for comprehensive analysis while enforcing the strictest security controls. The workspace root is set to the source directory to focus the scan on application code.

### Local Development Configuration
For local development and debugging, a more permissive configuration allows greater flexibility:

```env
# Local Development Configuration
WORKSPACE_ROOT=./test-project
LLM_MODEL=claude-sonnet-4-5-20250929
SECURITY_PROFILE=permissive
```

This setup enables developers to test the full range of tool capabilities while still benefiting from AI-powered security analysis. The moderate LLM model provides good analysis depth with faster response times suitable for interactive development.

### Security Audit Configuration
For comprehensive security audits, a strict profile combined with a powerful LLM model provides maximum thoroughness:

```env
# Security Audit Configuration
WORKSPACE_ROOT=./
LLM_MODEL=claude-opus-4-5-20251101
SECURITY_PROFILE=strict
```

This configuration scans the entire repository with the most capable LLM model available, ensuring the most comprehensive vulnerability detection possible.

**Section sources**
- [.env.example](file://.env.example#L1-L33)
- [config.ts](file://src/config.ts#L71-L78)

## Trade-offs Between Thoroughness and Performance

The configuration choices for security profiles involve significant trade-offs between analysis thoroughness and performance characteristics. Stricter security profiles, while providing stronger guarantees against unintended modifications, may limit the agent's ability to perform certain diagnostic operations that could aid in vulnerability detection.

More advanced LLM models like `claude-opus` provide deeper analysis and better reasoning capabilities but require longer processing times and incur higher costs compared to lighter models like `claude-sonnet`. The workspace root setting also impacts performance, with larger codebases requiring more time and resources to analyze comprehensively.

The security profile selection directly affects the agent's operational capabilities:
- **Strict profiles** maximize security but may miss certain vulnerabilities that require interactive exploration
- **Moderate profiles** balance security with functionality, enabling most analysis operations while preventing code modifications
- **Permissive profiles** offer maximum flexibility for debugging and development but reduce security guarantees

Organizations must evaluate their specific requirements to determine the appropriate balance between security, thoroughness, and performance for their use cases.

**Section sources**
- [security-config.ts](file://src/tools/security-config.ts#L70-L98)
- [config.ts](file://src/config.ts#L71-L78)

## Guidance for Organizational Security Requirements

Organizations should select security profiles based on their specific security requirements, compliance obligations, and operational workflows. For production environments and regulated industries, the strict security profile is strongly recommended to ensure read-only operations and prevent any possibility of code modification during security scans.

Development teams may benefit from using moderate or permissive profiles during the development phase to enable more interactive debugging and analysis capabilities, while enforcing strict profiles for pre-commit or pre-deployment scanning.

The LLM model selection should consider both the required analysis depth and budget constraints, with more critical systems warranting investment in higher-capability models. The workspace root configuration should be tailored to the specific scope of analysis needed, whether focusing on high-risk components or conducting comprehensive repository-wide scans.

Regular review and adjustment of these configurations based on evolving security requirements and threat landscapes is essential for maintaining effective security posture over time.

**Section sources**
- [security-config.ts](file://src/tools/security-config.ts#L32-L179)
- [config.ts](file://src/config.ts#L71-L78)
- [index.ts](file://index.ts#L17-L21)