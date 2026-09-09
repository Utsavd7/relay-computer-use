// Generated Relay capability invocation. Policy, waits, outcomes and checkpoint stay in the shared executor.
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const artifact = {
  "schema_version": "1.0",
  "id": "get_savings_balance",
  "version": 1,
  "name": "Savings balance",
  "description": "Read a member savings balance through the live banking UI.",
  "vendor": "relay-core",
  "supported_versions": [
    "1.0",
    "1.1"
  ],
  "inputs": {
    "member_id": {
      "type": "string",
      "pattern": "^\\d{5}$",
      "sensitive": true
    }
  },
  "outputs": {
    "balance": "number",
    "currency": "string"
  },
  "steps": [
    {
      "action": "fill",
      "target": {
        "kind": "field",
        "name": "Member ID"
      },
      "input": "member_id"
    },
    {
      "action": "click",
      "target": {
        "kind": "control",
        "name": "Search members"
      }
    },
    {
      "action": "click",
      "target": {
        "kind": "control",
        "name": "Open member"
      }
    },
    {
      "action": "click",
      "target": {
        "kind": "control",
        "name": "Savings account"
      }
    },
    {
      "action": "read",
      "target": {
        "kind": "text",
        "name": "Savings balance"
      },
      "output": "balance"
    }
  ],
  "checkpoint": {
    "text": "Account overview",
    "identity_field": "Member ID"
  },
  "outcomes": [
    {
      "text": "Member not found",
      "code": "MEMBER_NOT_FOUND"
    },
    {
      "text": "Validation error",
      "code": "VALIDATION_ERROR"
    }
  ],
  "recoveries": [
    {
      "text": "Temporary connection error",
      "target": {
        "kind": "control",
        "name": "Retry load"
      },
      "max_attempts": 2
    },
    {
      "text": "Service notice",
      "target": {
        "kind": "control",
        "name": "Dismiss notice"
      },
      "max_attempts": 1
    }
  ],
  "provenance": {
    "kind": "llm-discovery",
    "model": "mlx-community/Qwen3-4B-Instruct-2507-4bit",
    "created_at": "2026-09-09T14:27:14.102Z",
    "run_id": "49bfe00d-50a1-4819-82da-9f99b5180921"
  },
  "approval": {
    "state": "approved",
    "successful_replays": 5,
    "failed_replays": 0,
    "reviewer": "Local reviewer"
  }
};
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
try {
 await page.goto(process.env.RELAY_URL || 'http://localhost:3000/?app=1');
 await page.waitForFunction(() => !!window.relay);
 const result = await page.evaluate(async ({ artifact, member_id }) => window.relay.invoke(artifact, { member_id }), { artifact, member_id: process.env.MEMBER_ID || '67890' });
 console.log(JSON.stringify(result.result));
 if (result.result.status === 'failure') process.exitCode = 1;
} finally { await browser.close(); }
