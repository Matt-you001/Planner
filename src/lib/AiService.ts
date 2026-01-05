import { z } from 'zod';

// Define the types locally since we can't import from server code
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

export type SuggestHabitStackOutput = z.infer<typeof SuggestHabitStackOutputSchema>;

// A simple local AI simulation that returns context-aware suggestions
// In a real production app, this would call a Cloud Function or API endpoint.
export const AiService = {
  async suggestHabitStack(goalDescription: string): Promise<SuggestHabitStackOutput> {
    // Simulate network delay for realism
    await new Promise(resolve => setTimeout(resolve, 1500));

    const goal = goalDescription.toLowerCase();

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

    // Default generic suggestion
    return {
        trigger: { title: "After I [Current Habit]", description: "Identify a reliable daily anchor." },
        response: { title: "Do [Small Version of Goal]", description: "Make it easy to start." },
        stacked: { title: "Do [Related Quick Task]", description: "Build momentum." },
        reward: { title: "Enjoy [Simple Treat]", description: "Immediate gratification." }
    };
  },

  async suggestHabits(goalDescription: string): Promise<string[]> {
    await new Promise(resolve => setTimeout(resolve, 1500));
    const goal = goalDescription.toLowerCase();

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

    return [
        `Spend 5 minutes planning for ${goalDescription}`,
        `Do one small task related to ${goalDescription}`,
        `Read about how to improve at ${goalDescription}`,
        "Track progress in a journal",
        "Visualise success for 2 minutes"
    ];
  }
};
