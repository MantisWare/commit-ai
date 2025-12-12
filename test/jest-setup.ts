// Temporarily disabled cli-testing-library due to ESM import issues
// These are only needed for E2E tests, not unit tests
// import 'cli-testing-library/extend-expect'
// import { configure } from 'cli-testing-library'
import { jest } from '@jest/globals';

global.jest = jest;

/**
 * Adjusted the wait time for waitFor/findByText to 2000ms, because the default 1000ms makes the test results flaky
 */
// configure({ asyncUtilTimeout: 2000 })
