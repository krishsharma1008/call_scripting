export type ConversionStatus = 'booked' | 'converted' | 'lost' | 'in_progress';

export type CallHistoryItem = {
  callId: string;
  customerName: string;
  customerPhone: string;
  csrName: string;
  date: string;
  duration: number; // seconds
  conversionStatus: ConversionStatus;
  finalLeadScore: number;
  leadScoreChange: number;
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
    overall: 'positive' | 'neutral' | 'negative';
    averageScore: number;
  };
  servicesDiscussed: string[];
  summary: string;
  isActive: boolean;
  isRealData: boolean;
};

// Full detailed session type matching backend CallSession
export type DetailedCallSession = {
  callId: string;
  customerPhone: string;
  startTime: string;
  endTime: string;
  duration: number;
  transcript: Array<{
    role: string;
    content: string;
    timestamp: string;
    sentiment?: 'positive' | 'neutral' | 'negative';
    sentimentScore?: number;
  }>;
  nudgesShown: Array<{
    id: string;
    type: 'upsell' | 'cross_sell' | 'tip';
    title: string;
    body: string;
    priority: 1 | 2 | 3;
    timestamp: string;
  }>;
  leadScoreHistory: Array<{ score: number; timestamp: string; reason?: string }>;
  finalLeadScore: number;
  initialLeadScore: number;
  customerData: { firstName: string; lastName: string; zipcode: string; phone: string };
  overallSentiment: { positive: number; neutral: number; negative: number; averageScore: number };
  servicesDiscussed: string[];
  transcriptSummary: string;
  conversationMetrics: {
    talkTimeRatio: {
      csrWordCount: number;
      customerWordCount: number;
      csrPercentage: number;
      customerPercentage: number;
    };
    responseQuality: {
      questionsAnswered: number;
      acknowledgmentCount: number;
      empathyScore: number;
      overallScore: number;
    };
    keyTopics: Array<{ topic: string; frequency: number; category: string }>;
    conversionIndicators: {
      appointmentStatus: 'booked' | 'discussed' | 'not_mentioned';
      pricingDiscussed: boolean;
      pricingAmounts: string[];
      objectionsRaised: Array<{ objection: string; resolved: boolean }>;
      commitmentLevel: 'high' | 'medium' | 'low';
    };
  };
};

const firstNames = [
  'Sarah', 'Michael', 'Jennifer', 'David', 'Lisa', 'Robert', 'Amanda', 'James',
  'Emily', 'Christopher', 'Jessica', 'Daniel', 'Ashley', 'Matthew', 'Michelle',
  'Andrew', 'Stephanie', 'Joseph', 'Nicole', 'Ryan'
];

const lastNames = [
  'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez',
  'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
  'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee'
];

const csrNames = [
  'Alex Thompson',
  'Jordan Martinez',
  'Taylor Chen',
  'Morgan Anderson',
  'Casey Williams',
  'Riley Johnson'
];

const services = [
  'Dryer Vent Cleaning',
  'Dryer Vent Inspection',
  'Dryer Vent Repair',
  'Dryer Vent Installation',
  'HVAC Maintenance',
  'Air Duct Cleaning'
];

const summaries = [
  'Customer inquired about dryer vent cleaning services. Discussed pricing and availability. Successfully booked appointment for next Tuesday.',
  'Residential customer called regarding dryer efficiency issues. Recommended inspection and cleaning. Customer expressed interest but wants to discuss with spouse first.',
  'Follow-up call for existing customer. Discussed additional HVAC maintenance services. Customer was very satisfied with previous service.',
  'New customer inquiry about dryer vent installation for new construction. Provided detailed quote and timeline. Customer comparing with other providers.',
  'Customer concerned about fire hazards from lint buildup. Emergency service requested and scheduled. High priority appointment confirmed.',
  'Routine maintenance call. Customer has been with us for 3 years. Scheduled annual dryer vent inspection and cleaning.',
  'Customer called about unusual dryer noises. Recommended immediate inspection. Appointment booked for same-day service.',
  'Commercial property manager inquiring about multi-unit dryer vent services. Discussed bulk pricing and maintenance contracts.',
  'Customer had questions about dryer vent safety standards. Provided educational information and scheduled inspection.',
  'Upset customer regarding previous service. Listened to concerns and offered complimentary follow-up inspection to ensure satisfaction.',
  'New homeowner asking about dryer vent cleaning frequency. Educated on best practices and booked first service appointment.',
  'Customer interested in comprehensive home maintenance package including dryer vent and HVAC services.',
  'Quick inquiry about service availability. Customer needed immediate assistance due to dryer malfunction.',
  'Friendly conversation with long-term customer. Discussed seasonal maintenance and booked services for fall.',
  'Customer comparing service packages. Provided detailed breakdown of all options and benefits.',
  'Landlord calling about rental property maintenance. Discussed tenant coordination and scheduled services.',
  'Customer reported improved dryer efficiency after our last service. Called to schedule next annual maintenance.',
  'New customer referral from existing client. High interest in premium service package with warranty.',
  'Customer had concerns about pricing. Explained value proposition and offered flexible payment options.',
  'Quick and efficient call. Customer knew exactly what they needed and booked appointment immediately.'
];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPhone(): string {
  const area = randomInt(200, 999);
  const prefix = randomInt(200, 999);
  const line = randomInt(1000, 9999);
  return `(${area}) ${prefix}-${line}`;
}

function randomDate(daysAgo: number): string {
  const now = new Date();
  const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  // Add random hours and minutes
  date.setHours(randomInt(8, 18), randomInt(0, 59), randomInt(0, 59));
  return date.toISOString();
}

function generateConversionStatus(): ConversionStatus {
  const rand = Math.random();
  if (rand < 0.30) return 'booked';
  if (rand < 0.70) return 'converted';
  if (rand < 0.90) return 'lost';
  return 'in_progress';
}

function generateSentiment(conversionStatus: ConversionStatus): CallHistoryItem['sentiment'] {
  let positive: number, neutral: number, negative: number;
  
  if (conversionStatus === 'booked' || conversionStatus === 'converted') {
    // More positive sentiment for successful calls
    positive = randomInt(50, 80);
    negative = randomInt(0, 10);
    neutral = 100 - positive - negative;
  } else if (conversionStatus === 'lost') {
    // More negative sentiment for lost calls
    negative = randomInt(30, 60);
    positive = randomInt(10, 30);
    neutral = 100 - positive - negative;
  } else {
    // Balanced for in-progress
    positive = randomInt(30, 50);
    negative = randomInt(10, 30);
    neutral = 100 - positive - negative;
  }

  const overall = positive > neutral && positive > negative ? 'positive' :
                  negative > positive && negative > neutral ? 'negative' : 'neutral';
  
  const averageScore = (positive * 1.0 + neutral * 0.5 + negative * 0.0) / 100;

  return { positive, neutral, negative, overall, averageScore };
}

function generateServices(): string[] {
  const count = randomInt(1, 3);
  const selected: string[] = [];
  const availableServices = [...services];
  
  for (let i = 0; i < count; i++) {
    if (availableServices.length === 0) break;
    const index = randomInt(0, availableServices.length - 1);
    selected.push(availableServices[index]);
    availableServices.splice(index, 1);
  }
  
  return selected;
}

function generateLeadScore(conversionStatus: ConversionStatus): { final: number; change: number } {
  let final: number;
  
  if (conversionStatus === 'booked') {
    final = randomInt(75, 95) / 10; // 7.5 - 9.5
  } else if (conversionStatus === 'converted') {
    final = randomInt(65, 85) / 10; // 6.5 - 8.5
  } else if (conversionStatus === 'lost') {
    final = randomInt(20, 50) / 10; // 2.0 - 5.0
  } else {
    final = randomInt(50, 70) / 10; // 5.0 - 7.0
  }
  
  const change = randomInt(-15, 30) / 10; // -1.5 to 3.0
  
  return { final, change };
}

export function generateMockCallData(): CallHistoryItem[] {
  const calls: CallHistoryItem[] = [];
  const count = randomInt(15, 20);
  
  for (let i = 0; i < count; i++) {
    const firstName = randomElement(firstNames);
    const lastName = randomElement(lastNames);
    const conversionStatus = generateConversionStatus();
    const sentiment = generateSentiment(conversionStatus);
    const leadScores = generateLeadScore(conversionStatus);
    
    calls.push({
      callId: `mock-${Date.now()}-${i}`,
      customerName: `${firstName} ${lastName}`,
      customerPhone: randomPhone(),
      csrName: randomElement(csrNames),
      date: randomDate(randomInt(0, 30)),
      duration: randomInt(180, 900), // 3-15 minutes
      conversionStatus,
      finalLeadScore: leadScores.final,
      leadScoreChange: leadScores.change,
      sentiment,
      servicesDiscussed: generateServices(),
      summary: randomElement(summaries),
      isActive: false,
      isRealData: false
    });
  }
  
  // Sort by date descending (most recent first)
  calls.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  return calls;
}

// Export singleton instance for consistency across page loads during a session
let cachedMockData: CallHistoryItem[] | null = null;

export function getMockCallData(): CallHistoryItem[] {
  if (!cachedMockData) {
    cachedMockData = generateMockCallData();
  }
  return cachedMockData;
}

// Reset mock data (useful for testing)
export function resetMockCallData(): void {
  cachedMockData = null;
}

// Generate detailed call session for dashboard view
export function generateDetailedCallSession(historyItem: CallHistoryItem): DetailedCallSession {
  const [firstName, lastName] = historyItem.customerName.split(' ');
  const startTime = new Date(historyItem.date);
  const endTime = new Date(startTime.getTime() + historyItem.duration * 1000);
  
  // Generate realistic transcript based on call context
  const transcript = generateTranscript(
    historyItem.conversionStatus,
    historyItem.servicesDiscussed,
    historyItem.sentiment.overall,
    historyItem.duration
  );
  
  // Generate nudges
  const nudges = generateNudges(historyItem.conversionStatus, historyItem.servicesDiscussed);
  
  // Generate lead score history
  const leadScoreHistory = generateLeadScoreHistory(
    historyItem.finalLeadScore,
    historyItem.leadScoreChange,
    transcript.length,
    startTime
  );
  
  // Generate conversation metrics
  const conversationMetrics = generateConversationMetrics(
    historyItem.conversionStatus,
    historyItem.servicesDiscussed,
    transcript.length
  );
  
  return {
    callId: historyItem.callId,
    customerPhone: historyItem.customerPhone,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    duration: historyItem.duration,
    transcript,
    nudgesShown: nudges,
    leadScoreHistory,
    finalLeadScore: historyItem.finalLeadScore,
    initialLeadScore: historyItem.finalLeadScore - historyItem.leadScoreChange,
    customerData: {
      firstName: firstName || 'Unknown',
      lastName: lastName || 'Customer',
      zipcode: `${randomInt(10000, 99999)}`,
      phone: historyItem.customerPhone
    },
    overallSentiment: historyItem.sentiment,
    servicesDiscussed: historyItem.servicesDiscussed,
    transcriptSummary: historyItem.summary,
    conversationMetrics
  };
}

// Helper: Generate realistic transcript
function generateTranscript(
  conversionStatus: ConversionStatus,
  services: string[],
  sentiment: 'positive' | 'neutral' | 'negative',
  duration: number
): Array<{
  role: string;
  content: string;
  timestamp: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number;
}> {
  const transcript: Array<any> = [];
  const turnCount = Math.floor(duration / 30); // ~30 seconds per turn
  const now = new Date();
  
  const openings = [
    { role: 'assistant', content: 'Hi, I need help with my dryer vent. It\'s not working properly.', sentiment: 'neutral' as const },
    { role: 'user', content: 'Thank you for calling Neighborly! My name is Sarah. How can I help you today?', sentiment: 'positive' as const },
  ];
  
  const conversationTemplates = {
    booked: [
      { role: 'assistant', content: 'I\'d like to schedule a dryer vent cleaning as soon as possible.', sentiment: 'positive' as const },
      { role: 'user', content: 'I\'d be happy to help you with that! Let me check our availability.', sentiment: 'positive' as const },
      { role: 'assistant', content: 'Great! What times do you have available this week?', sentiment: 'positive' as const },
      { role: 'user', content: 'We have openings on Tuesday at 2 PM or Thursday at 10 AM. Which works better for you?', sentiment: 'positive' as const },
      { role: 'assistant', content: 'Tuesday at 2 PM would be perfect. How much will this cost?', sentiment: 'positive' as const },
      { role: 'user', content: 'The dryer vent cleaning service is $129, and it includes a full inspection. Would you like to add a safety inspection for $45?', sentiment: 'positive' as const },
      { role: 'assistant', content: 'Yes, let\'s add the safety inspection. I want to make sure everything is working properly.', sentiment: 'positive' as const },
      { role: 'user', content: 'Excellent choice! Your total will be $174. Let me get your address to confirm the appointment.', sentiment: 'positive' as const },
      { role: 'assistant', content: 'My address is 123 Main Street. Will you send a confirmation?', sentiment: 'positive' as const },
      { role: 'user', content: 'Yes, you\'ll receive a confirmation email and text message. Is there anything else I can help you with?', sentiment: 'positive' as const },
      { role: 'assistant', content: 'No, that\'s everything. Thank you so much for your help!', sentiment: 'positive' as const },
      { role: 'user', content: 'You\'re welcome! We look forward to seeing you on Tuesday. Have a great day!', sentiment: 'positive' as const },
    ],
    converted: [
      { role: 'assistant', content: 'I\'m interested in getting my dryer vent cleaned. Can you tell me more about your services?', sentiment: 'neutral' as const },
      { role: 'user', content: 'Absolutely! We offer comprehensive dryer vent cleaning that includes lint removal, duct inspection, and airflow testing.', sentiment: 'positive' as const },
      { role: 'assistant', content: 'That sounds good. How long does it typically take?', sentiment: 'neutral' as const },
      { role: 'user', content: 'Most cleanings take about 1-2 hours depending on the condition of your vent. We can usually do same-day service.', sentiment: 'positive' as const },
      { role: 'assistant', content: 'What about pricing? I want to make sure it fits my budget.', sentiment: 'neutral' as const },
      { role: 'user', content: 'Our standard cleaning is $129, which is very competitive. We also offer a bundle with HVAC duct cleaning for $199 total, saving you $50.', sentiment: 'positive' as const },
      { role: 'assistant', content: 'The bundle sounds like a good deal. Let me check with my spouse and I\'ll call back to schedule.', sentiment: 'positive' as const },
      { role: 'user', content: 'That sounds perfect! I\'ll send you an email with all the details. When would be a good time for us to follow up?', sentiment: 'positive' as const },
      { role: 'assistant', content: 'Tomorrow afternoon would work. Thanks for all the information!', sentiment: 'positive' as const },
      { role: 'user', content: 'You\'re welcome! I\'ll make a note to follow up tomorrow. Looking forward to working with you!', sentiment: 'positive' as const },
    ],
    lost: [
      { role: 'assistant', content: 'I\'m calling about dryer vent cleaning. How much do you charge?', sentiment: 'neutral' as const },
      { role: 'user', content: 'Our dryer vent cleaning service is $129, which includes a complete cleaning and inspection.', sentiment: 'positive' as const },
      { role: 'assistant', content: 'That seems expensive. I saw other companies charging around $80.', sentiment: 'negative' as const },
      { role: 'user', content: 'I understand your concern. Our pricing reflects our thorough process and experienced technicians. We also include a satisfaction guarantee.', sentiment: 'positive' as const },
      { role: 'assistant', content: 'I appreciate that, but I need to stay within budget. Maybe I\'ll call back later.', sentiment: 'negative' as const },
      { role: 'user', content: 'I completely understand. Would you like me to email you information about our services for when you\'re ready?', sentiment: 'neutral' as const },
      { role: 'assistant', content: 'No, that\'s okay. I\'ll reach out if I need to. Thanks anyway.', sentiment: 'negative' as const },
      { role: 'user', content: 'No problem at all. Feel free to contact us anytime. Have a good day!', sentiment: 'neutral' as const },
    ],
    in_progress: [
      { role: 'assistant', content: 'Hi, I\'m interested in your dryer vent services but have some questions first.', sentiment: 'neutral' as const },
      { role: 'user', content: 'Of course! I\'m happy to answer any questions. What would you like to know?', sentiment: 'positive' as const },
      { role: 'assistant', content: 'What exactly is included in the dryer vent cleaning service?', sentiment: 'neutral' as const },
      { role: 'user', content: 'Great question! We remove all lint buildup, clean the entire duct system, check for blockages, and test airflow to ensure efficiency.', sentiment: 'positive' as const },
      { role: 'assistant', content: 'How often should dryer vents be cleaned?', sentiment: 'neutral' as const },
      { role: 'user', content: 'We recommend annual cleaning for most households. If you use your dryer heavily or have pets, twice a year is better for safety.', sentiment: 'positive' as const },
      { role: 'assistant', content: 'I see. Let me think about it and discuss with my family. Can I call back?', sentiment: 'neutral' as const },
      { role: 'user', content: 'Absolutely! Take your time. Would you like me to email you our service details and pricing?', sentiment: 'positive' as const },
      { role: 'assistant', content: 'Yes, that would be helpful. My email is customer@example.com.', sentiment: 'neutral' as const },
      { role: 'user', content: 'Perfect! I\'ll send that over right away. Feel free to call us anytime with questions!', sentiment: 'positive' as const },
    ],
  };
  
  const template = conversationTemplates[conversionStatus];
  const baseConversation = [...openings, ...template];
  
  // Generate transcript with timestamps and sentiment scores
  baseConversation.forEach((turn, index) => {
    const timestamp = new Date(now.getTime() + index * 30000); // 30 seconds between turns
    const sentimentScore = turn.sentiment === 'positive' ? randomInt(70, 95) / 100 :
                          turn.sentiment === 'negative' ? randomInt(10, 40) / 100 :
                          randomInt(40, 70) / 100;
    
    transcript.push({
      role: turn.role,
      content: turn.content,
      timestamp: timestamp.toISOString(),
      sentiment: turn.sentiment,
      sentimentScore
    });
  });
  
  return transcript;
}

// Helper: Generate nudges
function generateNudges(
  conversionStatus: ConversionStatus,
  services: string[]
): Array<any> {
  const nudges: Array<any> = [];
  const now = new Date();
  
  const nudgeTemplates = [
    {
      id: 'nudge-1',
      type: 'upsell' as const,
      title: 'Safety Inspection Bundle',
      body: 'Add safety inspection for $45. Identifies fire hazards & improves efficiency by 30%.',
      priority: 1 as const
    },
    {
      id: 'nudge-2',
      type: 'cross_sell' as const,
      title: 'HVAC Duct Cleaning',
      body: 'Dryer vent & HVAC share ductwork. Bundle saves $50 & improves air quality.',
      priority: 2 as const
    },
    {
      id: 'nudge-3',
      type: 'tip' as const,
      title: 'Ask About Last Cleaning',
      body: 'Ask: "When did you last clean the vent?" Reveals urgency. 3+ years = high fire risk.',
      priority: 2 as const
    },
    {
      id: 'nudge-4',
      type: 'upsell' as const,
      title: 'Annual Maintenance Plan',
      body: 'Offer yearly plan at $99/year. Saves $30 and ensures regular safety checks.',
      priority: 1 as const
    },
  ];
  
  const nudgeCount = conversionStatus === 'booked' ? 3 : conversionStatus === 'converted' ? 2 : 1;
  
  for (let i = 0; i < nudgeCount && i < nudgeTemplates.length; i++) {
    nudges.push({
      ...nudgeTemplates[i],
      timestamp: new Date(now.getTime() + (i + 2) * 60000).toISOString()
    });
  }
  
  return nudges;
}

// Helper: Generate lead score history
function generateLeadScoreHistory(
  finalScore: number,
  scoreChange: number,
  turnCount: number,
  startTime: Date
): Array<{ score: number; timestamp: string; reason?: string }> {
  const history: Array<any> = [];
  const initialScore = finalScore - scoreChange;
  const steps = Math.min(turnCount / 2, 5); // Update every 2 turns, max 5 updates
  
  const reasons = [
    'Initial score based on customer history',
    'Customer expressed urgency',
    'Positive engagement detected',
    'Pricing discussion - ready to book',
    'Commitment signal - high interest',
    'Questions about timeline',
    'Budget concerns mentioned'
  ];
  
  history.push({
    score: initialScore,
    timestamp: startTime.toISOString(),
    reason: reasons[0]
  });
  
  for (let i = 1; i <= steps; i++) {
    const progress = i / steps;
    const score = initialScore + (scoreChange * progress);
    const timestamp = new Date(startTime.getTime() + (i * 60000)).toISOString();
    
    history.push({
      score: Math.round(score * 10) / 10,
      timestamp,
      reason: reasons[i] || reasons[reasons.length - 1]
    });
  }
  
  return history;
}

// Helper: Generate conversation metrics
function generateConversationMetrics(
  conversionStatus: ConversionStatus,
  services: string[],
  turnCount: number
): any {
  const csrWordCount = randomInt(150, 300);
  const customerWordCount = randomInt(100, 250);
  const total = csrWordCount + customerWordCount;
  
  const questionsAnswered = randomInt(3, 8);
  const acknowledgmentCount = randomInt(2, 6);
  const empathyScore = conversionStatus === 'booked' ? randomInt(75, 95) :
                       conversionStatus === 'converted' ? randomInt(65, 85) :
                       conversionStatus === 'lost' ? randomInt(40, 65) :
                       randomInt(55, 75);
  
  const topicsPool = [
    { topic: 'Dryer Vent Safety', category: 'concerns' },
    { topic: 'Service Pricing', category: 'pricing' },
    { topic: 'Appointment Scheduling', category: 'scheduling' },
    { topic: 'Fire Hazard Prevention', category: 'concerns' },
    { topic: 'Vent Cleaning Process', category: 'services' },
    { topic: 'Service Duration', category: 'services' },
    { topic: 'Inspection Benefits', category: 'services' },
  ];
  
  const keyTopics = topicsPool.slice(0, randomInt(4, 7)).map(topic => ({
    ...topic,
    frequency: randomInt(2, 8)
  }));
  
  const appointmentStatus = conversionStatus === 'booked' ? 'booked' :
                            conversionStatus === 'converted' ? 'discussed' :
                            'not_mentioned';
  
  const pricingAmounts = ['$129', '$45', '$174'];
  const objectionsRaised = conversionStatus === 'lost' ? [
    { objection: 'Price too high compared to competitors', resolved: false }
  ] : conversionStatus === 'converted' ? [
    { objection: 'Need to check with spouse first', resolved: true }
  ] : [];
  
  const commitmentLevel = conversionStatus === 'booked' ? 'high' :
                          conversionStatus === 'converted' ? 'medium' :
                          'low';
  
  return {
    talkTimeRatio: {
      csrWordCount,
      customerWordCount,
      csrPercentage: Math.round((csrWordCount / total) * 100),
      customerPercentage: Math.round((customerWordCount / total) * 100)
    },
    responseQuality: {
      questionsAnswered,
      acknowledgmentCount,
      empathyScore,
      overallScore: Math.round((questionsAnswered * 10 + acknowledgmentCount * 15 + empathyScore) / 3)
    },
    keyTopics,
    conversionIndicators: {
      appointmentStatus: appointmentStatus as 'booked' | 'discussed' | 'not_mentioned',
      pricingDiscussed: true,
      pricingAmounts,
      objectionsRaised,
      commitmentLevel: commitmentLevel as 'high' | 'medium' | 'low'
    }
  };
}

