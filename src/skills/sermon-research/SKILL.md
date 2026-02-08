---
name: sermon-research
description: A skill for The Mind to assist in theological research and sermon preparation.
---

# Sermon Research Skill

This skill guides the agent in researching a topic or scripture passage for a sermon. It leverages external search for information and local memory ("The Confessional") for past insights.

## Steps

1.  **Analyze Request**: Identify the key scripture passage or theological topic provided by the user.

2.  **Recall Past Insights**:
    -   Use the tool `recall_memories` with a query related to the topic/scripture.
    -   *Goal*: Check if we have covered this before or have related illustrations/notes stored in the Confessional.

3.  **Conduct Research**:
    -   Use `web_search` (or `browser` to visit specific theology sites) to find:
        -   **Exegetical Context**: Historical background, author, audience.
        -   **Original Language**: Key Hebrew/Greek words and their nuances.
        -   **Theological Themes**: Cross-references and systematic theology connections.
        -   **Illustrations**: Contemporary examples or metaphors.

4.  **Store Insights**:
    -   Use the tool `remember_fact` to save the most valuable insights.
    -   *Tagging*: Use tags like `["sermon", "theology", "<topic>"]`.

5.  **Synthesize Brief**:
    -   Compile the findings into a **Sermon Brief** format:
        -   **Title/Topic**
        -   **Scripture**: The text.
        -   **Exegetical Insight**: What it meant then.
        -   **Theological Principle**: The timeless truth.
        -   **Confessional Memory**: Any relevant past insights found.
        -   **Application**: How it applies today.
