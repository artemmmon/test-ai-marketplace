# Code review

Use when reviewing a pull request or a diff.

## Checklist

1. **Correctness**: does the change do what the description says? Edge cases?
2. **Tests**: is changed behaviour covered? Do the tests fail without the change?
3. **Security**: input validation, secrets, injection, authorisation checks.
4. **Readability**: names, function size, comments that explain *why*.

See `checklist.md` for the full list.

## Output

Group findings as **Blocking** and **Notes**. Start with a one-line verdict.
