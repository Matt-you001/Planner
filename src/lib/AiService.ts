import { z } from 'zod';
import { auth } from '../firebase';

export const HabitComponentSchema = z.object({
  title: z.string().describe("The suggested title for this activity."),
  description: z.string().describe("A brief explanation of why this component is suggested.")
});

export const SuggestHabitStackOutputSchema = z.object({
  trigger: HabitComponentSchema,
  response: HabitComponentSchema,
  stacked: HabitComponentSchema,
  reward: HabitComponentSchema
});

const SuggestHabitsOutputSchema = z.object({
  suggestions: z.array(z.string()).min(1)
});

const NextBestActionSchema = z.object({
  title: z.string(),
  reason: z.string(),
  suggestedDuration: z.string().optional(),
  confidence: z.number().min(0).max(1).optional()
});

export type SuggestHabitStackOutput = z.infer<typeof SuggestHabitStackOutputSchema>;
export type NextBestAction = z.infer<typeof NextBestActionSchema>;

type OnlineAiPayload = {
  type: 'habit-stack' | 'habit-list' | 'next-best-action';
  goalDescription: string;
  context?: Record<string, unknown>;
};

const RAW_AI_API_URL = process.env.EXPO_PUBLIC_AI_API_URL;
const AI_API_KEY = process.env.EXPO_PUBLIC_AI_API_KEY;

const normalizeAiEndpoint = (value?: string) => {
  if (!value) return null;

  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  if (trimmed.endsWith('/ai-coach')) return trimmed;
  return `${trimmed}/ai-coach`;
};

const AI_API_URL = normalizeAiEndpoint(RAW_AI_API_URL);

const hasOnlineAi = () => Boolean(AI_API_URL);

async function callOnlineAi<T>(payload: OnlineAiPayload, schema: z.ZodSchema<T>): Promise<T | null> {
  if (!AI_API_URL) return null;

  try {
    const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : null;
    const response = await fetch(AI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(AI_API_KEY ? { Authorization: `Bearer ${AI_API_KEY}` } : {}),
        ...(idToken ? { 'X-Firebase-Auth': idToken } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`AI request failed with status ${response.status}`);
    }

    const json = await response.json();
    return schema.parse(json);
  } catch (error) {
    console.warn('Online AI request failed, falling back to local suggestions.', error);
    return null;
  }
}

function localHabitStack(goalDescription: string): SuggestHabitStackOutput {
  const goal = goalDescription.toLowerCase();
  const cleanGoal = goalDescription.trim();
  const shortGoal = cleanGoal.replace(/^(to\s+)/i, '').replace(/\s+/g, ' ').trim();
  const startsWithActionVerb = /^(build|create|launch|start|finish|learn|study|write|exercise|train|save|budget|design|plan|practice|read|improve|grow|cook|clean|organize|develop)\b/i.test(shortGoal);
  const goalAction = startsWithActionVerb ? shortGoal : `work on ${shortGoal}`;

  if (goal.includes('health') || goal.includes('fit') || goal.includes('weight') || goal.includes('run') || goal.includes('exercise')) {
    return {
      trigger: { title: "After I put on my running shoes", description: "Use a physical object as a cue." },
      response: { title: "Do 20 minutes of exercise", description: "The core habit you want to build." },
      stacked: { title: "Drink a protein shake", description: "Immediate post-workout nutrition." },
      reward: { title: "Track progress in app", description: "Visual reinforcement of your streak." }
    };
  }

  if (goal.includes('money') || goal.includes('finance') || goal.includes('save') || goal.includes('budget')) {
    return {
      trigger: { title: "After I buy my morning coffee", description: "Link to a spending event." },
      response: { title: "Check bank balance", description: "Awareness is the first step." },
      stacked: { title: "Transfer $5 to savings", description: "Small, frictionless saving action." },
      reward: { title: "Read 1 page of finance book", description: "Educational reinforcement." }
    };
  }

  if (goal.includes('learn') || goal.includes('study') || goal.includes('read') || goal.includes('spanish') || goal.includes('language')) {
    return {
      trigger: { title: "After I pour my evening tea", description: "Relaxation time anchor." },
      response: { title: "Study for 15 minutes", description: "Focused learning session." },
      stacked: { title: "Write down 3 new words", description: "Active recall practice." },
      reward: { title: "Watch a YouTube video", description: "Relaxing reward." }
    };
  }

  if (goal.includes('meditat') || goal.includes('mind') || goal.includes('stress') || goal.includes('calm')) {
    return {
      trigger: { title: "After I brush my teeth", description: "Morning hygiene anchor." },
      response: { title: "Meditate for 5 minutes", description: "Start small to build consistency." },
      stacked: { title: "Write 3 things I'm grateful for", description: "Positive mindset stacking." },
      reward: { title: "Enjoy a hot shower", description: "Sensory reward." }
    };
  }

  if (goal.includes('writ') || goal.includes('blog') || goal.includes('journal')) {
    return {
      trigger: { title: "After I open my laptop", description: "Digital environment cue." },
      response: { title: "Write 200 words", description: "Low barrier to entry." },
      stacked: { title: "Edit the previous day's work", description: "Refining skills." },
      reward: { title: "Check social media for 5 mins", description: "Guilt-free browsing." }
    };
  }

  if (goal.includes('build') || goal.includes('house') || goal.includes('project') || goal.includes('launch')) {
    return {
      trigger: { title: "After I sit down for my focused work block", description: "Use a repeatable work session as the cue." },
      response: { title: `Review the next milestone for ${shortGoal}`, description: "Start by getting clear on the next concrete step." },
      stacked: { title: "Complete one small planning or execution task", description: "Momentum grows when the next move is specific and doable." },
      reward: { title: "Record what moved forward before taking a break", description: "Noticing progress makes the habit easier to repeat." }
    };
  }

  if (goal.includes('business') || goal.includes('brand') || goal.includes('client') || goal.includes('sales')) {
    return {
      trigger: { title: "After I open my workspace in the morning", description: "Anchor the habit to the start of the workday." },
      response: { title: "Do one action that grows visibility or revenue", description: "Tie the habit directly to business progress." },
      stacked: { title: "Follow up on one pending lead or task", description: "Keep momentum moving with one quick follow-through." },
      reward: { title: "Update my progress tracker and take a short reset", description: "A visible win makes it easier to return tomorrow." }
    };
  }

  return {
    trigger: { title: "After I finish my first routine task of the day", description: "Use an anchor that already happens consistently." },
    response: { title: `${goalAction.charAt(0).toUpperCase()}${goalAction.slice(1)} for 10 focused minutes`, description: "A short, repeatable version of the goal is easier to sustain." },
    stacked: { title: `Prepare the next step for ${shortGoal}`, description: "Lining up tomorrow's next move keeps the habit alive." },
    reward: { title: "Mark the session complete and take a short break", description: "A quick reward helps reinforce consistency." }
  };
}

function localHabitList(goalDescription: string): string[] {
  const goal = goalDescription.toLowerCase();
  const cleanGoal = goalDescription.trim();
  const shortGoal = cleanGoal.replace(/^(to\s+)/i, '').replace(/\s+/g, ' ').trim();

  if (goal.includes('health') || goal.includes('fit') || goal.includes('run')) {
    return [
      "Drink a glass of water immediately after waking up",
      "Do 5 minutes of stretching before breakfast",
      "Walk for 10 minutes after lunch",
      "Eat one serving of vegetables with dinner",
      "Pack gym clothes the night before"
    ];
  }

  if (goal.includes('money') || goal.includes('finance')) {
    return [
      "Check bank account balance daily",
      "Pack lunch instead of buying out",
      "Wait 24 hours before making any non-essential purchase",
      "Read one article about investing",
      "Review weekly expenses on Sunday"
    ];
  }

  if (goal.includes('writ')) {
    return [
      "Write 50 words before checking email",
      "Write down 3 ideas for new topics",
      "Read 5 pages of a book in your genre",
      "Edit one paragraph from yesterday",
      "Journal for 5 minutes before bed"
    ];
  }

  if (goal.includes('build') || goal.includes('house')) {
    return [
      "List the next 3 milestones and choose the one you can start this week",
      "Research one contractor, permit, material, or cost decision that is blocking progress",
      "Create or update a simple budget for the next phase of the project",
      "Make one call or send one message that moves the house project forward",
      "Review the plan at the end of the day and note what changed"
    ];
  }

  if (goal.includes('business') || goal.includes('brand') || goal.includes('startup')) {
    return [
      "Identify the single most important outcome for the business this week",
      "Reach out to one potential customer, partner, or mentor",
      "Spend 20 minutes improving one part of your offer or product",
      "Review what generated traction recently and double down on it",
      "Write down one risk, one opportunity, and one next action"
    ];
  }

  if (goal.includes('learn') || goal.includes('study') || goal.includes('exam') || goal.includes('course')) {
    return [
      "Review one concept you already know before starting something new",
      "Study for 20 focused minutes with notifications turned off",
      "Write down 3 key takeaways from today's learning session",
      "Test yourself with 5 quick questions instead of only rereading notes",
      "Prepare the exact topic you will study next"
    ];
  }

  if (goal.includes('design') || goal.includes('ui') || goal.includes('ux')) {
    return [
      "Collect 3 strong references before starting a design session",
      "Redesign one screen or component with a single clear improvement goal",
      "Write down why the design should feel better for the user",
      "Ask for one round of feedback on a focused design choice",
      "Review your work and capture one lesson before ending the session"
    ];
  }

  return [
    `Define the next concrete milestone for ${shortGoal}`,
    `Do one focused task that makes ${shortGoal} move forward today`,
    `Prepare the tools, materials, or notes you need for the next session`,
    `Review what is blocking progress on ${shortGoal} and remove one obstacle`,
    "Capture one short note about what worked before you stop"
  ];
}

function localNextBestAction(goalDescription: string, context?: Record<string, unknown>): NextBestAction {
  const streak = typeof context?.completedCount === 'number' ? context.completedCount : 0;
  const recentProgress = typeof context?.recentProgress === 'number' ? context.recentProgress : 0;

  if (recentProgress < 30) {
    return {
      title: `Do the smallest possible step toward ${goalDescription}`,
      reason: "Momentum is low, so the best next move is a quick win that lowers friction.",
      suggestedDuration: "5-10 min",
      confidence: 0.8
    };
  }

  if (streak >= 7) {
    return {
      title: `Increase the challenge slightly for ${goalDescription}`,
      reason: "You already have consistency, so a small progression can help you keep improving.",
      suggestedDuration: "15-20 min",
      confidence: 0.76
    };
  }

  return {
    title: `Schedule your next focused block for ${goalDescription}`,
    reason: "The app works best when the next action is explicit and placed on the calendar.",
    suggestedDuration: "10-15 min",
    confidence: 0.72
  };
}

export const AiService = {
  isOnlineConfigured() {
    return hasOnlineAi();
  },

  async suggestHabitStack(goalDescription: string): Promise<SuggestHabitStackOutput> {
    const onlineResult = await callOnlineAi(
      {
        type: 'habit-stack',
        goalDescription,
      },
      SuggestHabitStackOutputSchema
    );

    if (onlineResult) return onlineResult;

    await new Promise(resolve => setTimeout(resolve, 600));
    return localHabitStack(goalDescription);
  },

  async suggestHabits(goalDescription: string): Promise<string[]> {
    const onlineResult = await callOnlineAi(
      {
        type: 'habit-list',
        goalDescription,
      },
      SuggestHabitsOutputSchema
    );

    if (onlineResult) return onlineResult.suggestions;

    await new Promise(resolve => setTimeout(resolve, 600));
    return localHabitList(goalDescription);
  },

  async suggestNextBestAction(goalDescription: string, context?: Record<string, unknown>): Promise<NextBestAction> {
    const onlineResult = await callOnlineAi(
      {
        type: 'next-best-action',
        goalDescription,
        context,
      },
      NextBestActionSchema
    );

    if (onlineResult) return onlineResult;

    await new Promise(resolve => setTimeout(resolve, 400));
    return localNextBestAction(goalDescription, context);
  }
};
