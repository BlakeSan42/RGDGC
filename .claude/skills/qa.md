---
name: qa
description: Run the full QA suite — backend tests, TypeScript checks, endpoint verification, health check
---

# QA Suite

## When to use
When the user says "test", "qa", "check everything", or before any commit/deploy.

## Steps

### 1. Backend Python tests
```bash
cd backend && source venv/bin/activate && PYTHONPATH=$(pwd) python -m pytest tests/ --tb=line -q
```
Expected: 155+ tests passing, 0 failures.

### 2. Mobile TypeScript
```bash
cd mobile && npx tsc --noEmit
```
Expected: 0 errors.

### 3. Admin Dashboard TypeScript
```bash
cd admin-dashboard && npx tsc --noEmit
```
Expected: 0 errors.

### 4. MCP Server TypeScript
```bash
cd mcp-server && npx tsc --noEmit
```
Expected: 0 errors.

### 5. Solidity contract tests
```bash
cd contracts && npx hardhat test
```
Expected: 58 tests passing.

### 6. Health check
```bash
bash scripts/health-check.sh
```
Expected: 6/6 core checks passing (admin-dashboard and expo-dev-server are optional).

### 7. API endpoint verification
```bash
curl -sf http://localhost:8001/health
curl -sf http://localhost:8001/openapi.json | python3 -c "import sys,json; print(f'{len(json.load(sys.stdin)[\"paths\"])} endpoints')"
```
Expected: healthy, 76+ endpoints.

### 8. GeoJSON verification
```bash
curl -sf "http://localhost:8001/api/v1/geo/courses/1/geojson" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{d[\"properties\"][\"total_features\"]} features')"
```
Expected: 57 features.

## Report format
```
| Check | Result |
|-------|--------|
| Backend tests | X/X passing |
| Mobile TS | 0 errors |
| Admin TS | 0 errors |
| MCP TS | 0 errors |
| Solidity | X/X passing |
| Health | X/X passing |
| Endpoints | X live |
| GeoJSON | X features |
```

## If something fails
1. Check signals/active_issues.json for known issues
2. Run the failing test in isolation to confirm it's not flaky
3. Fix and re-run
4. Update signals/resolution_log.md with the fix
