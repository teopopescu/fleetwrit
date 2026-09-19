---
layout: ../../layouts/DocsLayout.astro
title: Integrations
description: Each integration wraps a framework's own pause mechanism, so your team keeps its checkpointing and adds Fleetwrit's queue, identity and record.
---

## How integrations work

Fleetwrit does not replace your framework's pause-and-resume — it wraps it. The integration turns a native interrupt into a Fleetwrit request, waits for a decision, verifies the receipt, and resumes the framework exactly where it stopped. Your checkpointing is unchanged.

Each integration ships as a PyPI extra so the core stays dependency-free:

```bash
pip install "fleetwrit[langchain]"      # or [llamaindex], [openai-agents], [agentcore]
```

## Agent runtimes

| Integration | Hooks into | What you write |
| --- | --- | --- |
| LangGraph / LangChain | `interrupt()` and `Command(resume=...)`; LangChain HITL middleware | `FleetwritMiddleware(...)` or `fleetwrit_node()` |
| LlamaIndex Workflows | `InputRequiredEvent` / `HumanResponseEvent` | `FleetwritHITL(workflow)` |
| OpenAI Agents SDK | `needs_approval`, `result.interruptions`, `RunState` | `await fleetwrit_run(agent, input)` |
| Amazon Bedrock AgentCore | Gateway Lambda interceptor in front of MCP tools | Deploy the interceptor, list gated tools |

## LangGraph example

```python
from langgraph.graph import StateGraph
from fleetwrit.integrations.langchain import FleetwritMiddleware

middleware = FleetwritMiddleware(tools={"rollback_deployment": True})

graph = StateGraph(State)
graph.add_node("act", middleware.wrap(act_node))
app = graph.compile(checkpointer=checkpointer)
```

When `act` calls a gated tool, the graph pauses with a native `interrupt()`, Fleetwrit creates the request, and the graph resumes via `Command(resume=decision)` once a reviewer decides. Kill the process mid-wait and it re-attaches on restart.

## Bedrock AgentCore

AgentCore gates at the tool gateway, so it covers any framework running on AgentCore Runtime **without touching agent code**. A tool call arriving without a valid receipt is held, turned into a Fleetwrit request, and retried with the receipt attached once approved. It ships as a Lambda with a SAM template.

## Blocking vs interrupt mode

- **Blocking** (default): the SDK long-polls and survives a restart. Best for long-running processes.
- **Interrupt**: the SDK raises the runtime's own interrupt and resumes from a signed webhook. Best for checkpointing runtimes that tear down between steps.

## Contract tests

Every integration ships a contract suite that:

1. pauses, decides, and resumes on that one terminal decision;
2. **kills the agent process mid-wait** and checks the decision is delivered and consumed at most once;
3. exercises the rejection path and the expiry path.

Run them against the oldest supported and the latest framework version:

```bash
nox -s contract-langchain
```

## Status

The live list of runtimes, identity providers, policy engines and notification channels — with `available` / `next` / `planned` status — is on the [integrations section of the site](/#integrations). Vote for what you need next on the linked GitHub issues.

## Next steps

- [Identity](/docs/identity) — connect the IdP reviewers sign in with.
- [Asking a human](/docs/asking) — the calls the integrations wrap.
