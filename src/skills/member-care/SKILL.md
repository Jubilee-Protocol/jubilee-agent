---
name: member-care
description: A skill for The Mind to assist in pastoral care, tracking member needs, and drafting communications.
---

# Member Care Skill

This skill helps the agent act as a "Digital Deacon" by tracking member life events and assisting in follow-up. It strictly adheres to the "Confessional" privacy standard—data is stored in local memory.

## Steps

1.  **Analyze Update**:
    -   Identify the **Member Name**, **Event** (Surgery, Birth, Death, Crisis), and **Date/Urgency**.
    -   Determine the appropriate pastoral response (Visit, Call, Text, Meal Train).

2.  **Recall Context**:
    -   Use `recall_memories` with the member's name.
    -   *Goal*: Find spouse/kids' names or past struggles to personalize the response (e.g., "How is Bob holding up?").

3.  **Store Event**:
    -   Use `remember_fact` to log the new event.
    -   *Format*: "Member Care: [Name] - [Event] on [Date]."
    -   *Tags*: `["member_care", "<event_type>"]`.

4.  **Draft Follow-Up**:
    -   Draft a text message or email for the pastor to send.
    -   *Tone*: Compassionate, brief, personal (mention family if found in memory).
    -   *Output Pattern*:
        ```
        **Pastoral Action Required**: [Call/Text]
        **Context**: [Summary of event + history]
        **Draft Message**: "[Draft text]"
        ```

5.  **Prayer Point**:
    -   Generate a 1-sentence prayer point for the staff meeting.
