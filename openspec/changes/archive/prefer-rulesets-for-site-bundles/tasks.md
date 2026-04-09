## 1. Spec

- [x] 1.1 Update `rule-authoring` spec for official rule-set catalog and ruleSet-first site bundles
- [x] 1.2 Update `cli-workflow` spec for rule-set inspection command

## 2. Code

- [x] 2.1 Add official rule-set catalog module with refreshable cache
- [x] 2.2 Add hidden CLI command to inspect configured and official rule-set tags
- [x] 2.3 Refactor site bundle registry to declare preferred rule-set tags and fallback domain matchers
- [x] 2.4 Update deterministic authoring to prefer configured official ruleSet matchers
- [x] 2.5 Extend example/default rule-set coverage where built-in bundles have stable official tags

## 3. Validation

- [x] 3.1 Add unit tests for official rule-set catalog refresh and cache behavior
- [x] 3.2 Add authoring tests for ruleSet-first site-bundle resolution and fallback behavior
- [x] 3.3 Run targeted tests
- [x] 3.4 Run full repository validation
