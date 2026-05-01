import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const owner = process.env.GITHUB_OWNER || 'PIGU-PPPgu';
const query = `query($user:String!){ user(login:$user){ contributionsCollection{ contributionCalendar{ totalContributions weeks{ contributionDays{ date contributionCount weekday } } } } } }`;

const raw = execFileSync('gh', ['api', 'graphql', '-f', `query=${query}`, '-F', `user=${owner}`], { encoding: 'utf8' });
const json = JSON.parse(raw);
const calendar = json.data.user.contributionsCollection.contributionCalendar;
const days = calendar.weeks.flatMap(week => week.contributionDays).map(day => ({
  date: day.date,
  count: day.contributionCount,
  weekday: day.weekday
}));

fs.mkdirSync('content/activity', { recursive: true });
fs.writeFileSync('content/activity/github-contributions.json', `${JSON.stringify({
  owner,
  generatedAt: new Date().toISOString(),
  totalContributions: calendar.totalContributions,
  days
}, null, 2)}\n`);

console.log(`Synced ${days.length} contribution days for ${owner}.`);
