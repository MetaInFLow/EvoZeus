# Security Policy

EvoZeus reviews Agent Sessions, so privacy and evidence handling are part of the product surface.

## Supported Status

The project is currently in protocol bootstrap. There is no production service and no cloud upload path.

## Default Safety Model

- Local first by default.
- No raw session upload.
- No automatic GitHub PR or issue creation.
- No secret, token, customer, private path, or unreleased code in public Cases.
- Evidence should be minimized to what is needed for the verdict.

## Reporting a Security Issue

If you find a security issue in the repository, open a GitHub security advisory if available. If not, open a public issue with only non-sensitive details and say that private reproduction details are available to maintainers.

Do not publish:

- API keys or tokens
- Session logs containing private content
- Customer data
- Private repository paths
- Unreleased product information
- Exploit details that enable abuse before a fix exists

## Redaction Expectations

Before submitting a Case, replace sensitive values with stable placeholders:

```text
<PRIVATE_REPO>
<CUSTOMER_NAME>
<TOKEN_REDACTED>
<LOCAL_PATH>
<EMAIL_REDACTED>
```

Keep enough structure for the evidence to remain useful.
