/* Mission 13: behavioral questions, resume probes, and questions to ask them. */
(function () {
  var B = LAB.b;

  LAB.addChapter({
    id: 'm13', n: 13, title: 'People, stories and resume probes', short: 'Behavioral', blurb: 'STAR stories, 13 years vs 3 to 5, questions to ask', minutes: 24,
    focus: ['con', 'air', 'qual', 'ci', 'mon'],
    goals: [
      'Tell a story in **STAR form in 30 to 60 seconds**.',
      'Answer **"13 years, but the role asks for 3 to 5"** without sounding defensive.',
      'Handle **disagreement, mistakes and ownership** questions with specifics.',
      'Ask **questions that make you look senior**.'
    ],
    say: 'Mission 13 is about stories. Senior interviews often turn on behavioral answers, and many strong engineers under-prepare them. The model answers here are shapes anchored on your resume. Replace the details with your own real ones.',
    scenes: [
      B.talk({
        id: 'm13-star', title: 'STAR in 30 seconds, and your story bank',
        say: 'One structure for every story, then six stories to prepare. Press Next.',
        items: [
          ['S and T: one sentence each', 'Situation: what was happening and what was at stake. Task: your responsibility. Keep both short. Interviewers lose interest in long set-ups.', 'Set the scene in two sentences, no more.'],
          ['A: the longest part, and it says "I"', 'Say what **you** did, in order. "We" hides your contribution. Name the tool, the decision and the reason.', 'The action is the story. Say "I", name the decision and the reason.'],
          ['R: a number, then a lesson', 'A measurable result, or what was avoided. Then one sentence about what you changed afterwards. Seniors always add the lesson.', 'End with a number and a lesson.'],
          ['Your six stories', '**1.** A production incident. **2.** A performance or cost win (Bank of America warehouse tuning). **3.** A disagreement about a metric or design. **4.** Delivering with application developers (REST APIs at Wells Fargo). **5.** A mistake you owned. **6.** Something you built that others still use (the governance standard, the Terraform and Jenkins automation).', 'Prepare these six. They cover almost every question.']
        ],
        cols: 1
      }),

      B.qa({
        id: 'qa-why', tag: 'Motivation', secs: 45,
        q: 'Why this role, and why are you looking to move?',
        pts: ['Specific pull: dbt Core, Snowflake and Airflow together', 'Working with application developers and analysts', 'What you want to build and learn', 'Positive about current and past roles', 'Fit with the team and scope'],
        short: 'What attracts me is the combination: dbt Core on Snowflake with Airflow, delivered next to application developers and analysts, which is the work I enjoy most and the stack I have built production platforms on for more than five years. I want a role where I own the data layer end to end, from modelling and quality to delivery, and where I can keep building rather than only managing.\n\nMy current work is going well. I am looking for the next scope: a team where the data layer is a product that application features rely on, and where documentation, testing and ownership are taken as seriously as I take them.',
        fu: [['What do you want to learn here?', 'Pick something real and relevant: for example the team\'s domain, a part of the stack you use less, such as dbt Cloud or a streaming layer, or a scale you have not run at yet.']],
        trap: 'Criticising your current employer or saying "I need a change". Stay **positive and specific** about what pulls you toward this role.'
      }),

      B.qa({
        id: 'qa-senior', tag: 'Resume probe', secs: 45,
        q: 'You have 13 years of experience and this role asks for 3 to 5. Why this level?',
        pts: ['Scope matches what you want to do hands-on', 'Not looking to move into management', 'Depth is an advantage: faster, fewer mistakes, mentoring', 'Interest in the stack and the problem, not the title', 'Open and positive tone'],
        short: 'The scope matches what I want to do every day: dbt Core on Snowflake with Airflow, working with application teams. I am not looking to move into management. I want to stay hands-on.\n\nMy experience is an advantage for the team in practical ways. I have seen the failure modes, late files, schema drift, duplicate keys, cost spikes, so I design for them from the start. I ramp quickly on a new domain, and I can mentor engineers with fewer years. I care more about the problem and the team than the title.',
        fu: [['Will you be bored or leave quickly?', 'No. Breadth is what keeps it interesting: modelling, quality, orchestration, CI/CD and working with consumers. Depth means I spend my time on the hard problems, and I like those.']],
        trap: 'Sounding defensive, or implying the role is beneath you. Frame it as **fit and value**, not as a sacrifice.'
      }),

      B.qa({
        id: 'qa-conflict', tag: 'Behavioral', secs: 75,
        q: 'Tell me about a time you disagreed with a stakeholder about a metric definition or a design.',
        pts: ['Situation: two definitions, real consequence', 'You brought evidence: numbers from both definitions', 'Decision made by the right people, recorded', 'Outcome: one definition implemented, or two with clear names', 'Lesson: agree definitions before building'],
        short: 'The risk team and finance defined exposure differently: one included undrawn commitments and the other counted only drawn balances. Both were right for their purpose, but dashboards showed two numbers under one name.\n\nI did not pick a side. I computed both definitions on the same data, showed the difference side by side, and brought both teams to one conversation. We agreed to keep both, give them different names, and document each in the dbt model description. I implemented them as two measures in the fact table with tests.\n\nThe lesson I apply now: agree the definition in writing before I build. It is much cheaper than reconciling two dashboards later.',
        fu: [['What if they cannot agree?', 'Escalate with a short written summary of the options and the impact of each to whoever owns the metric, and ask for a decision. Do not implement a silent compromise.']],
        trap: 'Telling a story where you were simply right and the other person was wrong. Show that you **listened, used evidence and found a decision path**.',
        real: 'This is a template shape. At Wells Fargo you review model definitions with analytics, risk and platform stakeholders and explain trade-offs. **Use a real example from there.**'
      }),

      B.qa({
        id: 'qa-mistake', tag: 'Behavioral', secs: 60,
        q: 'Tell me about a mistake you made in production and what you changed afterwards.',
        pts: ['A real mistake, owned in the first sentence', 'Impact stated plainly', 'How it was found and fixed quickly', 'The systemic change: test, check, process', 'No blame, no excuses'],
        short: 'I shipped an incremental model that filtered on created_at instead of updated_at. Everything ran green, but corrected loans never updated in the mart, and a reconciliation against the source report showed the gap.\n\nI owned it right away: I reproduced it with one loan, changed the filter to updated_at with a three-day lookback, backfilled the affected loans and confirmed the totals. Then I fixed the cause, not just the model: I added a daily reconciliation between RAW and the marts, and a line to our review checklist for every incremental model.\n\nIt taught me that a green pipeline proves nothing about correctness, so I now build the check that would have caught it.',
        trap: 'Choosing a trivial mistake, or one that was really someone else\'s fault. Pick a real one, **own it in the first sentence**, and finish with the systemic fix.',
        real: 'The incremental-filter bug is a common real one and a good example, but **use a mistake that is genuinely yours.** A made-up story falls apart at the first follow-up.'
      }),

      B.qa({
        id: 'qa-own', tag: 'JD: ownership', secs: 60,
        q: 'The role stresses ownership and documentation habits. What does that look like in your work?',
        pts: ['Descriptions on models and columns in dbt docs', 'Lineage and exposures kept current', 'Runbooks for every pipeline', 'Governance standard at Bank of America', 'On-call and follow-through: fix, document, prevent'],
        short: 'Ownership means I own a pipeline from design to the 3 AM alert. In practice: every model and key column has a description in dbt docs, exposures show who depends on it, and every production workflow has a runbook with recovery steps, because the next person on call should not need me.\n\nAt Bank of America I wrote the data-governance standard covering PII handling and role-based access, with lineage kept audit-ready, and we had zero compliance incidents across more than 500 analytical users. At Wells Fargo I document transformation rules and recovery steps for each change. When something breaks I fix it, write down what happened, and add the check that prevents a repeat.',
        fu: [['How do you keep docs from going stale?', 'Make documentation part of the definition of done: a pull request without descriptions for new models does not merge. dbt docs are generated from the code, so they cannot drift far, and CI can enforce description coverage.']]
      }),

      B.qa({
        id: 'qa-prio', tag: 'Behavioral', secs: 45, opt: true,
        q: 'Everything is urgent. How do you prioritize?',
        pts: ['Ask about impact and deadline, not volume', 'Protect production first', 'Make trade-offs visible to stakeholders', 'Cut scope before quality gates', 'Communicate early'],
        short: 'I ask two questions for every request: what is the business impact, and what happens if it waits? Production issues come first because they affect trust. For the rest I rank by impact and deadline, and I make the trade-off visible: "If I do this first, that moves to Thursday. Is that acceptable?" Stakeholders accept a clear trade-off much more easily than a silent delay. When time is short I cut scope, never the quality gates, and I tell people early.'
      }),

      B.qa({
        id: 'qa-built', tag: 'Behavioral', secs: 60, opt: true,
        q: 'Tell me about something you built that other teams still use.',
        pts: ['What it is and who uses it', 'The problem it solved', 'Design choices that made it stick', 'A number', 'How you kept it maintained'],
        short: 'The clearest example is the data-governance standard I wrote at Bank of America, covering PII handling protocols and role-based access control, with lineage documentation kept audit-ready. It gave every team one pattern for sensitive data and gave audits one place to look. We ended with zero compliance incidents across more than 500 analytical users.\n\nAnother is the Terraform and Jenkins deployment automation I built at Citigroup, which cut manual intervention by 50 percent.',
        real: 'Choose the one **you can explain in the most detail**, and add the real reasons it stuck: how it was enforced, who adopted it, what changed. Detail is what makes it credible.'
      }),

      B.cheat({
        id: 'm13-ask', title: 'Questions to ask them',
        say: 'Always ask questions. They show seniority and help you judge the job. Pick four or five. Screenshot this page.',
        sections: [
          { h: 'About the work', items: ['How is the dbt project organised today, and how are changes tested before they reach production?', 'How do you orchestrate: which Airflow version, and is it managed or self-hosted?', 'How are Snowflake warehouses, roles and cost governed?', 'What does the path from a Jira ticket to production look like?'] },
          { h: 'About the team', items: ['Who are the main consumers of the data, and how do you agree contracts with application teams?', 'How is the team split between building new models and keeping existing pipelines healthy?', 'What does on-call look like, and how often do incidents happen?'] },
          { h: 'About success', items: ['What would success look like in the first 90 days?', 'What is the biggest data reliability problem today?', 'What would make you say, a year from now, that this hire was a great decision?'] },
          { h: 'Listen for red flags', items: ['No tests, no CI, or "we deploy by hand".', 'Nobody owns metric definitions.', 'No separate dev or test environment.', 'Heroics and constant firefighting described as normal.'] }
        ]
      }),

      B.recap({
        id: 'm13-recap', n: 13, badge: 'Storyteller', color: '#FBCFE8',
        pts: [
          '**STAR**: short situation, an action told with "I", a number and a lesson.',
          'Six stories: incident, performance win, disagreement, delivery with app developers, a mistake, something that lasts.',
          '13 years vs 3 to 5: **fit and value**, hands-on by choice, never defensive.',
          'Own the mistake in the first sentence. End with the systemic fix.',
          'Always ask four or five good questions.'
        ],
        lines: [
          'I owned it, I fixed it, and I changed the process so it cannot repeat.',
          'I agree definitions in writing before I build.',
          'I want to stay hands-on, and the scope of this role is exactly what I enjoy.'
        ]
      })
    ]
  });
})();
