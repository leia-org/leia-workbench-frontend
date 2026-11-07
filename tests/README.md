# Regression and integration tests

Implements [development #114](https://github.com/leia-org/development/issues/114).

```sh
npm ci
npm run test:regression
```

`npm test` runs the same finite suite; `npm run test:watch` is available for development. CI runs the regression command on Node 22 and 24 for pull requests and pushes to `main`/`develop`, without service credentials.

Authenticated fetch, cookie credentials, session-expired events, login failures, empty/non-JSON responses, network errors and replication-name persistence. Existing preview tests also run.

External side effects are replaced at the database, HTTP adapter/fetch, Redis or model-provider boundary. No MongoDB, Redis server or paid model API is needed. These tests complement browser and deployed-stack end-to-end tests.

## Integration tests

```sh
npm run test:integration
```

Production AuthProvider, ProtectedRoute, authFetch and router mount together in jsdom, using a real local HTTP server for session restore, protected requests, 401/logout/navigation and focus refresh. The real SessionTimer resumes its original deadline after remount.

CI runs integration separately on Node 24. No production service/repository method is mocked; local HTTP peers supply deterministic contracts for external dependencies. These suites do not assert real LLM answer quality or live audio.
