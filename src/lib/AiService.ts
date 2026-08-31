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
  confidence: z.number().min(0).max(1).optional(),
  coachMessage: z.string().optional(),
  achievementStage: z.string().optional(),
  tone: z.enum(['commend', 'encourage', 'motivate', 'steady']).optional()
});

const OrganizedDaySchema = z.object({
  summary: z.string().optional(),
  activities: z.array(z.object({
    sourceId: z.string(),
    title: z.string().min(1),
    durationMinutes: z.number().int().min(5).max(240),
    priority: z.enum(['High', 'Medium', 'Low']),
    reason: z.string().optional()
  })).min(1)
});

export type SuggestHabitStackOutput = z.infer<typeof SuggestHabitStackOutputSchema>;
export type NextBestAction = z.infer<typeof NextBestActionSchema>;
export type OrganizedDay = z.infer<typeof OrganizedDaySchema>;

type OnlineAiPayload = {
  type: 'habit-stack' | 'habit-list' | 'next-best-action' | 'organize-day';
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

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 6500) : null;

  try {
    const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : null;
    const response = await fetch(AI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(AI_API_KEY ? { Authorization: `Bearer ${AI_API_KEY}` } : {}),
        ...(idToken ? { 'X-Firebase-Auth': idToken } : {}),
      },
      ...(controller ? { signal: controller.signal } : {}),
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
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function normalizeGoalText(goalDescription: string) {
  return goalDescription.trim().replace(/\s+/g, ' ');
}

function cleanGoalLabel(goalDescription: string) {
  return normalizeGoalText(goalDescription).replace(/^(to\s+)/i, '').trim();
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function extractFocusArea(goalDescription: string) {
  const cleaned = cleanGoalLabel(goalDescription);
  const withoutArticles = cleaned.replace(/\b(a|an|the|my|your)\b/gi, '').trim();
  return withoutArticles || cleaned || 'your goal';
}

function localHabitStack(goalDescription: string): SuggestHabitStackOutput {
  const goal = goalDescription.toLowerCase();
  const shortGoal = cleanGoalLabel(goalDescription);
  const startsWithActionVerb = /^(build|create|launch|start|finish|learn|study|write|exercise|train|save|budget|design|plan|practice|read|improve|grow|cook|clean|organize|develop)\b/i.test(shortGoal);
  const goalAction = startsWithActionVerb ? shortGoal : `work on ${shortGoal}`;
  const focusArea = extractFocusArea(goalDescription);

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
      stacked: { title: `Complete one small task that clearly moves ${focusArea} forward`, description: "Momentum grows when the next move is specific and doable." },
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
    trigger: { title: "After I finish my usual morning reset", description: "Attach the routine to something that already happens without effort." },
    response: { title: `${goalAction.charAt(0).toUpperCase()}${goalAction.slice(1)} for one focused round`, description: "A defined, low-friction session is easier to repeat than an open-ended ambition." },
    stacked: { title: `Leave the next step for ${focusArea} ready before I stop`, description: "Preparing the next move makes it easier to restart tomorrow." },
    reward: { title: "Log the win and take a short intentional break", description: "A visible close to the session reinforces the habit loop." }
  };
}

function localHabitList(goalDescription: string): string[] {
  const goal = goalDescription.toLowerCase();
  const shortGoal = cleanGoalLabel(goalDescription);
  const focusArea = titleCase(extractFocusArea(goalDescription));

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
    `Write down the one outcome that would make ${focusArea} feel meaningfully closer today`,
    `Complete the smallest action that creates visible progress on ${shortGoal}`,
    `Gather the exact materials, information, or tools needed for the next focused session`,
    `Find one blocker slowing ${shortGoal} down and clear it before the day ends`,
    `Finish by logging what moved forward and what should happen next`
  ];
}

function localNextBestAction(goalDescription: string, context?: Record<string, unknown>): NextBestAction {
  const streak = typeof context?.completedCount === 'number' ? context.completedCount : 0;
  const recentProgress = typeof context?.recentProgress === 'number' ? context.recentProgress : 0;
  const successRate = typeof context?.successRate === 'number' ? context.successRate : recentProgress;
  const completedActions = typeof context?.completedActions === 'number' ? context.completedActions : 0;
  const pendingActions = typeof context?.pendingActions === 'number' ? context.pendingActions : 0;
  const habitStage = typeof context?.habitStage === 'string' ? context.habitStage : 'Intention';
  const journalEntries = typeof context?.journalEntries === 'number' ? context.journalEntries : 0;

  if (successRate >= 85 && completedActions >= 3) {
    return {
      title: `Protect the momentum you have built around ${goalDescription}`,
      reason: "Your success rate is strong, so the smartest next move is to reinforce what is already working and stretch carefully.",
      suggestedDuration: "10-20 min",
      confidence: 0.84,
      achievementStage: habitStage,
      tone: 'commend',
      coachMessage: `You are performing well on this plan with a success rate around ${successRate}%. That deserves recognition. Keep the structure that is helping you win, then choose one next action that extends this momentum without making the system fragile.`
    };
  }

  if (successRate >= 60 && pendingActions > 0) {
    return {
      title: `Finish the highest-impact remaining action for ${goalDescription}`,
      reason: "Your success rate shows solid traction, and completing one more meaningful action will convert progress into a stronger result.",
      suggestedDuration: "10-15 min",
      confidence: 0.8,
      achievementStage: habitStage,
      tone: 'motivate',
      coachMessage: `You are making real progress with a success rate near ${successRate}%. This is a good moment to stay focused, close the most important remaining action, and turn a good run into a strong one.`
    };
  }

  if (recentProgress < 30) {
    return {
      title: `Do the smallest possible step toward ${goalDescription}`,
      reason: "Momentum is low, so the best next move is a quick win that lowers friction.",
      suggestedDuration: "5-10 min",
      confidence: 0.8,
      achievementStage: habitStage,
      tone: 'encourage',
      coachMessage: journalEntries > 0
        ? `You are still in the ${habitStage} stage, and your journal shows you are paying attention. Your current success rate is about ${successRate}%, so keep the bar low today and win back momentum with one clear move.`
        : `You are still in the ${habitStage} stage. Your current success rate is about ${successRate}%, so start small, remove friction, and let today's win rebuild confidence.`
    };
  }

  if (streak >= 7) {
    return {
      title: `Increase the challenge slightly for ${goalDescription}`,
      reason: "You already have consistency, so a small progression can help you keep improving.",
      suggestedDuration: "15-20 min",
      confidence: 0.76,
      achievementStage: habitStage,
      tone: 'commend',
      coachMessage: `You have built real consistency around this goal. That deserves credit. The next step is not a reset, but a careful progression that stretches you without breaking the streak.`
    };
  }

  if (completedActions > 0 && pendingActions > 0) {
    return {
      title: `Finish the next unfinished action for ${goalDescription}`,
      reason: "You already have movement on this goal, so closing the next open loop will create visible progress quickly.",
      suggestedDuration: "10-15 min",
      confidence: 0.79,
      achievementStage: habitStage,
      tone: 'motivate',
      coachMessage: `You have already moved this goal forward. Keep that energy alive by finishing one pending action and giving yourself a cleaner path into the next stage.`
    };
  }

  return {
    title: `Schedule your next focused block for ${goalDescription}`,
    reason: "The app works best when the next action is explicit and placed on the calendar.",
    suggestedDuration: "10-15 min",
    confidence: 0.72,
    achievementStage: habitStage,
    tone: 'steady',
    coachMessage: `You are currently in the ${habitStage} stage. Stay steady, keep showing up, and make the next action visible on your schedule so progress does not stay abstract.`
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

    return localNextBestAction(goalDescription, context);
  },

  async organizeDay(
    activities: Array<{
      id: string;
      title: string;
      durationMinutes: number;
      priority: 'High' | 'Medium' | 'Low';
    }>,
    startTime: string,
    date: string
  ): Promise<OrganizedDay | null> {
    return callOnlineAi(
      {
        type: 'organize-day',
        goalDescription: `Organize the activities for ${date} into a practical execution schedule.`,
        context: {
          date,
          startTime,
          activities
        }
      },
      OrganizedDaySchema
    );
  }
};
