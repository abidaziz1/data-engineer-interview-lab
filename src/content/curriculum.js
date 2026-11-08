import { foundations, dbtCore, advancedDbt } from './lessons-dbt.js';
import { snowflake, modeling, python } from './lessons-platform.js';
import { airflow, governance, delivery, incidents } from './lessons-production.js';

export const modules = [foundations, dbtCore, advancedDbt, snowflake, modeling, python, airflow, governance, delivery, incidents];
export const lessons = modules.flatMap((module, moduleIndex) => module.lessons.map((lesson, index) => ({
  ...lesson, moduleId: module.id, moduleIndex, index, moduleTitle: module.title,
})));
export const getLesson = id => lessons.find(lesson => lesson.id === id) || lessons[0];
export const getModule = id => modules.find(module => module.id === id) || modules[0];
export const days = [
  { day: 1, title: 'Own the story. Understand the system.', modules: ['story', 'dbt'], minutes: 95, focus: 'Explain your current project and trace a row through dbt.', practice: 'Deliver your introduction in 90 seconds. Explain ref(), source(), build, and materializations without notes.' },
  { day: 2, title: 'Make the transformations reliable.', modules: ['advanced', 'sql'], minutes: 140, focus: 'Duplicates, corrections, incremental loads, Jinja, SQL, and dimensional modeling.', practice: 'Walk through T101’s correction. Solve latest-row deduplication and an SCD Type 2 join.' },
  { day: 3, title: 'Run it on a real platform.', modules: ['snowflake', 'python'], minutes: 115, focus: 'Snowflake performance and Python ingestion, with failure-aware design.', practice: 'Explain scan cost versus concurrency. Describe pagination, rate limits, checkpoints, and replay.' },
  { day: 4, title: 'Operate and ship with confidence.', modules: ['airflow', 'quality', 'delivery'], minutes: 160, focus: 'Scheduling, testing, security, CI/CD, and the application data contract.', practice: 'Recover a failed run safely. Explain what blocks publication and how code rollback differs from data recovery.' },
  { day: 5, title: 'Think aloud under pressure.', modules: ['incidents'], minutes: 80, focus: 'Production incidents, architecture tradeoffs, resume verification, and a mock interview.', practice: 'Do a timed mock. Review every “revisit” question, the resume evidence checklist, and the last-hour brief.' },
];

export const sources = [
  { name: 'dbt documentation', url: 'https://docs.getdbt.com/docs/introduction', note: 'Models, materializations, tests, Jinja, Python, and deployment concepts.' },
  { name: 'dbt incremental models', url: 'https://docs.getdbt.com/docs/build/incremental-models', note: 'is_incremental(), unique_key, filtering, and full refresh.' },
  { name: 'dbt Python models', url: 'https://docs.getdbt.com/docs/build/python-models', note: 'Platform execution and Python model limitations.' },
  { name: 'Snowflake documentation', url: 'https://docs.snowflake.com/en/user-guide/intro-key-concepts', note: 'Storage, compute, cloud services, and platform behavior.' },
  { name: 'Snowflake query performance', url: 'https://docs.snowflake.com/en/user-guide/performance-query-exploring', note: 'Use query profiles to validate performance decisions.' },
  { name: 'Apache Airflow documentation', url: 'https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/overview.html', note: 'DAGs, tasks, scheduling, and runtime concepts. Check your deployed major version.' },
  { name: 'Airflow best practices', url: 'https://airflow.apache.org/docs/apache-airflow/stable/best-practices.html', note: 'Idempotent tasks, secure connections, and avoiding heavy DAG parsing.' },
  { name: 'GitHub Pages documentation', url: 'https://docs.github.com/en/pages', note: 'How to publish this static learning app.' },
];
