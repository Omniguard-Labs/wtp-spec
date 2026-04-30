# GitHub Setup

Use GitHub Free for organizations. Do not start an Enterprise trial unless paid enterprise features are required.

## Repository Name

- Organization: `wtv-standard`
- Repository: `wtv-spec`
- Full repository URL: `https://github.com/wtv-standard/wtv-spec`

Use `open-wtv` only if `wtv-standard` is unavailable.

## Create Organization

1. Sign in with your existing GitHub account.
2. Open GitHub organizations settings.
3. Create a new organization.
4. Choose GitHub Free.
5. Use the organization as the public home for the standard.

## Repository Settings

Enable:

- Issues
- Discussions
- Pull requests
- Security advisories
- Dependabot alerts

Disable initially:

- Wiki

## Branch Protection

Protect `main`:

- require pull requests;
- require CI to pass;
- require at least one review;
- block force pushes;
- block branch deletion.

## Teams

Create teams after the organization exists:

- `maintainers`
- `spec-reviewers`
- `sdk-reviewers`
- `interop-reviewers`

Then update `.github/CODEOWNERS` with the real organization name.
