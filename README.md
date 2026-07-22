# Speaking Gap

Speaking Gap is a situation-based speaking practice MVP. It is designed for moments when a learner thinks, “I knew what I wanted to say, but I could not say it in English.”

## Core loop

1. Save a real speaking gap quickly in Korean.
2. The app drafts one default English expression and only one or two alternatives.
3. Review shows the situation without the answer.
4. The learner speaks, gets meaning-focused feedback, and must repeat the improved expression.
5. A variation prompt checks whether the learner can assemble the expression instead of memorizing one fixed sentence.
6. Again / Hard / Good / Easy schedules the next review.

## Current MVP features

- Quick-save flow for situation, intended meaning, optional actual attempt, and tag.
- Template AI-style drafting for common workplace speaking gaps such as data, schedules, priorities, and apologies.
- Situation-only review with preparation cue, optional hints, browser speech recognition when available, and manual text fallback.
- Meaning-oriented feedback that recommends a speaking review grade using response length, hint use, elapsed time, and target expression chunks.
- Mandatory repeat step before rating the card.
- Variation prompts, targeted conversation missions, searchable expression library, due filter, and due/new sorting.
- Local persistence with `localStorage`; no external dependencies are required.

## Run locally

```bash
npm run dev
```

Open `http://localhost:5173` in a browser.

## Checks

```bash
npm run build
```
