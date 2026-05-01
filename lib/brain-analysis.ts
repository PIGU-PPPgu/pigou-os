import type { Idea, IdeaAnalysis, KnowledgeAnalysis, KnowledgeNote, KnowledgePlatform, Project } from '@/lib/data';
import { createChatJson, getLlmConfig } from '@/lib/ai-clients';

const platforms: KnowledgePlatform[] = ['github', 'wechat', 'xiaohongshu', 'zhihu', 'bilibili', 'website', 'paper', 'manual', 'other'];

export function localDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
}

export function detectPlatform(input: { sourceUrl?: string; rawText?: string; tags?: string[] }): KnowledgePlatform {
  const text = `${input.sourceUrl || ''}\n${input.rawText || ''}\n${(input.tags || []).join('\n')}`.toLowerCase();
  if (!text.trim()) return 'manual';
  if (text.includes('github.com')) return 'github';
  if (text.includes('xiaohongshu.com') || text.includes('xhslink.com')) return 'xiaohongshu';
  if (text.includes('zhihu.com')) return 'zhihu';
  if (text.includes('bilibili.com')) return 'bilibili';
  if (text.includes('weixin.qq.com') || text.includes('wechat')) return 'wechat';
  if (text.includes('arxiv.org') || text.includes('doi.org') || text.includes('.pdf')) return 'paper';
  if (/https?:\/\//.test(text)) return 'website';
  return 'manual';
}

function projectMatches(text: string, projects: Project[]) {
  const lower = text.toLowerCase();
  return projects
    .filter(project => lower.includes(project.slug.toLowerCase()) || lower.includes(project.title.toLowerCase()) || Boolean(project.domain && lower.includes(project.domain.toLowerCase())))
    .map(project => project.slug)
    .slice(0, 5);
}

function ideaMatches(text: string, ideas: Idea[]) {
  const lower = text.toLowerCase();
  return ideas
    .filter(idea => lower.includes(idea.slug.toLowerCase()) || lower.includes(idea.title.toLowerCase()) || idea.tags.some(tag => lower.includes(tag.toLowerCase())))
    .map(idea => idea.slug)
    .slice(0, 5);
}

function fallbackKnowledgeAnalysis(note: KnowledgeNote, projects: Project[], ideas: Idea[]): KnowledgeAnalysis {
  const text = [note.title, note.summary, note.keyPoints.join('\n'), note.tags.join('\n'), note.next || ''].join('\n');
  const projectLinks = Array.from(new Set([...(note.relatedProjects || []), ...projectMatches(text, projects)])).slice(0, 5);
  const ideaLinks = ideaMatches(text, ideas);
  return {
    intent: note.type === 'source' ? '捕获外部资料，并判断它对 Pigou 当前项目是否有用。' : '沉淀一条可复用的个人判断或项目洞察。',
    usefulness: projectLinks.length ? `可用于 ${projectLinks.join(', ')} 的判断、说明或下一步行动。` : '目前还没有强项目关联，适合先留在知识收件箱继续观察。',
    projectLinks,
    ideaLinks,
    actionSuggestions: [note.next || '判断这条内容应该转成任务、项目说明还是 idea 证据。'].filter(Boolean),
    relationReasoning: '基于标题、摘要、标签、相似笔记和项目 slug 做本地规则关联。',
    confidence: note.confidence
  };
}

function fallbackIdeaAnalysis(idea: Idea, knowledge: KnowledgeNote[], projects: Project[]): IdeaAnalysis {
  const text = [idea.title, idea.summary, idea.tags.join('\n'), idea.next || ''].join('\n').toLowerCase();
  const evidenceLinks = knowledge
    .filter(note => note.tags.some(tag => idea.tags.includes(tag) || text.includes(tag.toLowerCase())) || note.summary.toLowerCase().includes(idea.title.toLowerCase()))
    .map(note => note.slug)
    .slice(0, 6);
  const suggestedProject = projects.find(project => idea.tags.some(tag => project.summary.toLowerCase().includes(tag.toLowerCase()) || project.title.toLowerCase().includes(tag.toLowerCase())))?.slug;
  return {
    userPain: /老师|学生|班主任|用户|客户/.test(text) ? '已经出现明确用户场景，需要继续收集真实使用证据。' : '用户痛点还比较抽象，需要补充具体人群和使用场景。',
    opportunity: idea.score >= 75 ? '分数较高，值得进入小实验或项目草稿。' : '可以先作为低成本假设保留，等待更多证据。',
    feasibility: idea.status === 'building' || idea.status === 'validated' ? '已有验证或实现信号，可拆成任务推进。' : '仍处于火花阶段，建议先做最小验证。',
    risks: ['需求可能过宽，需要收敛到一个可验证场景。', '如果缺少证据，容易变成收藏而不是行动。'],
    evidenceLinks,
    suggestedProject,
    nextExperiment: idea.next || '写下目标用户、验证方式和 1 个本周可完成的小实验。'
  };
}

function asText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (value == null) return fallback;
  if (Array.isArray(value)) return value.map(item => asText(item)).filter(Boolean).join('\n');
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `${key}: ${asText(item)}`)
      .filter(Boolean)
      .join('\n');
  }
  return String(value);
}

function asTextList(value: unknown, fallback: string[]) {
  if (Array.isArray(value)) return value.map(item => asText(item)).filter(Boolean).slice(0, 6);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return fallback;
}

export async function analyzeKnowledgeNote(note: KnowledgeNote, projects: Project[], ideas: Idea[]) {
  const fallback = fallbackKnowledgeAnalysis(note, projects, ideas);
  if (!getLlmConfig().apiKey) return fallback;

  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['intent', 'usefulness', 'projectLinks', 'ideaLinks', 'actionSuggestions', 'relationReasoning', 'confidence'],
    properties: {
      intent: { type: 'string' },
      usefulness: { type: 'string' },
      projectLinks: { type: 'array', items: { type: 'string' } },
      ideaLinks: { type: 'array', items: { type: 'string' } },
      actionSuggestions: { type: 'array', items: { type: 'string' } },
      relationReasoning: { type: 'string' },
      confidence: { type: 'string', enum: ['low', 'medium', 'high'] }
    }
  };

  const parsed = await createChatJson<Partial<KnowledgeAnalysis>>({
    schemaName: 'pigou_knowledge_analysis',
    schema,
    messages: [
      { role: 'system', content: '你是 Pigou OS 的知识脑分析器。根据这条笔记判断用途、关联项目、关联想法和下一步行动。中文输出，简洁具体。projectLinks 和 ideaLinks 只能返回给定 slug。' },
      { role: 'user', content: JSON.stringify({ note, projectSlugs: projects.map(project => project.slug), ideaSlugs: ideas.map(idea => idea.slug), fallback }, null, 2) }
    ]
  }).catch(() => null);

  return {
    ...fallback,
    ...parsed,
    projectLinks: Array.isArray(parsed?.projectLinks) ? parsed.projectLinks.filter(slug => projects.some(project => project.slug === slug)).slice(0, 5) : fallback.projectLinks,
    ideaLinks: Array.isArray(parsed?.ideaLinks) ? parsed.ideaLinks.filter(slug => ideas.some(idea => idea.slug === slug)).slice(0, 5) : fallback.ideaLinks,
    actionSuggestions: Array.isArray(parsed?.actionSuggestions) && parsed.actionSuggestions.length ? parsed.actionSuggestions.slice(0, 5) : fallback.actionSuggestions,
    confidence: platforms.includes(note.platform || 'other') && ['low', 'medium', 'high'].includes(String(parsed?.confidence)) ? parsed?.confidence as KnowledgeAnalysis['confidence'] : fallback.confidence
  };
}

export async function analyzeIdea(idea: Idea, knowledge: KnowledgeNote[], projects: Project[]) {
  const fallback = fallbackIdeaAnalysis(idea, knowledge, projects);
  if (!getLlmConfig().apiKey) return fallback;

  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['userPain', 'opportunity', 'feasibility', 'risks', 'evidenceLinks', 'suggestedProject', 'nextExperiment'],
    properties: {
      userPain: { type: 'string' },
      opportunity: { type: 'string' },
      feasibility: { type: 'string' },
      risks: { type: 'array', items: { type: 'string' } },
      evidenceLinks: { type: 'array', items: { type: 'string' } },
      suggestedProject: { type: ['string', 'null'] },
      nextExperiment: { type: 'string' }
    }
  };

  const parsed = await createChatJson<Partial<IdeaAnalysis>>({
    schemaName: 'pigou_idea_analysis',
    schema,
    messages: [
      { role: 'system', content: '你是 Pigou OS 的 idea 孵化分析器。根据 idea、知识证据和项目列表输出用户痛点、机会、可行性、风险、证据链接和下一步实验。中文输出，evidenceLinks 和 suggestedProject 只能使用给定 slug。' },
      { role: 'user', content: JSON.stringify({ idea, knowledgeSlugs: knowledge.map(note => note.slug), projectSlugs: projects.map(project => project.slug), fallback }, null, 2) }
    ]
  }).catch(() => null);

  return {
    ...fallback,
    ...parsed,
    userPain: asText(parsed?.userPain, fallback.userPain),
    opportunity: asText(parsed?.opportunity, fallback.opportunity),
    feasibility: asText(parsed?.feasibility, fallback.feasibility),
    risks: asTextList(parsed?.risks, fallback.risks).slice(0, 5),
    evidenceLinks: Array.isArray(parsed?.evidenceLinks) ? parsed.evidenceLinks.filter(slug => knowledge.some(note => note.slug === slug)).slice(0, 6) : fallback.evidenceLinks,
    suggestedProject: typeof parsed?.suggestedProject === 'string' && projects.some(project => project.slug === parsed.suggestedProject) ? parsed.suggestedProject : fallback.suggestedProject,
    nextExperiment: asText(parsed?.nextExperiment, fallback.nextExperiment)
  };
}
