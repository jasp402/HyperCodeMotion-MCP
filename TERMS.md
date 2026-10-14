# HyperCodeMotion MCP — Terms of Service

**Effective date:** October 13, 2026  
**Scope:** The public HyperCodeMotion MCP service and its tools, **not** HyperCodeMotion Studio.

## 1. Service
HyperCodeMotion MCP is a public integration service for discovering supported HyperCodeMotion formats and performing preliminary checks of JSON compositions, designs, and improvement operations. The current public tools are `get_capabilities` and `validate_json`.

## 2. Preliminary validation only
A result marked `valid: true` means the submitted data passed the checks currently implemented by this MCP. It **does not** guarantee that HyperCodeMotion Studio will import, interpret, or render the JSON as intended. Results currently include `fullyValidated: false`. The supported capabilities catalog is a snapshot and may lag behind updates to Studio.

## 3. Use and restrictions
You may use the service for legitimate development, learning, and project validation. Do not use it to disrupt availability, bypass security controls, submit malicious traffic, probe other systems without authorization, or infringe others' rights. Do not include credentials or sensitive personal information in JSON submitted to the service.

## 4. Your content
You remain responsible for the JSON and other material you submit, including ensuring that you have rights to use it. You authorize the temporary technical processing required to respond to your request. Using the service does not transfer ownership of your project content to HyperCodeMotion.

## 5. Third-party platforms
The service depends on third-party hosting and may be invoked through third-party AI assistants. Their own terms and privacy practices may apply. This service is not affiliated with or endorsed by those providers merely because it can be connected to them.

## 6. Availability and changes
This service is currently offered without a guaranteed service-level agreement. Tools, rate limits, responses, supported formats, and availability may change. Access may be limited or suspended to protect the service or comply with legal obligations.

## 7. No warranty
To the extent permitted by applicable law, the service is provided **“AS IS” and “AS AVAILABLE,”** without warranties of uninterrupted availability, accuracy, fitness for a particular purpose, or successful rendering in Studio. You should test important projects in the editor and keep independent backups.

## 8. Responsibility and liability
You are responsible for reviewing generated or validated results before relying on them. To the extent permitted by applicable law, the maintainers are not liable for indirect, incidental, special, consequential, or lost-data damages arising from the use of the service. Nothing here excludes rights or liabilities that applicable law does not allow to be excluded.

## 9. Open-source code versus hosted service
Source code in the [HyperCodeMotion-MCP repository](https://github.com/jasp402/HyperCodeMotion-MCP) is separately licensed under [Apache License 2.0](LICENSE). That license governs reuse of the covered source code; these Terms govern use of the hosted MCP endpoint. HyperCodeMotion and related names or logos are not licensed merely by the software license.

## 10. Privacy
Please read the [MCP Privacy Policy](PRIVACY.md).

## 11. Changes
We may update these Terms by publishing a new version in this repository. If you do not accept the revised Terms, stop using the service.

## 12. Support and notices
See [SUPPORT.md](SUPPORT.md) and [GitHub Issues](https://github.com/jasp402/HyperCodeMotion-MCP/issues). Do not post personal or confidential information in public issues.
