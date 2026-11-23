import type { Category, Lang } from './model';

type Dict = Record<string, string>;
const en: Dict = {
  kaji: 'Kaji', kajiSub: 'Housework, shared fairly',
  today: 'Today', week: 'Week', balance: 'Balance', chores: 'Chores', more: 'More',
  create: 'Create our household', join: 'Join', householdName: 'Household name', yourName: 'Your name', language: 'Language',
  setupAbout: 'Kaji splits the housework by how much each of you minds it, not only by minutes. Everything is editable.',
  inviteTitle: 'Invite the other person', inviteAbout: 'Type the Google address they sign in with. They open Nexo and tap Join.', invite: 'Invite', invited: 'Invited',
  joinTitle: 'You are invited', joinAbout: 'Join this household to see and share the chores.',
  start: 'Start', done: 'Done', stop: 'Stop', pause: 'Pause', resume: 'Resume', paused: 'Paused', notToday: 'Not today', swap: 'Swap', later: 'Later', undo: 'Undo',
  nothingToday: 'Nothing left for you today.', nothingTodayHelp: 'Enjoy it. Anything you do anyway can be logged with the plus.',
  yourChores: 'Your chores', theirChores: 'Their chores', running: 'Running', minutes: 'min', tama: 'tama',
  logAChore: 'Log a chore', logAbout: 'Anything you did, planned or not.', howLong: 'How long, about?', whichOne: 'Which chore?',
  rateTitle: 'How was it?', effort: 'How hard', mind: 'How much you minded', enjoy: 'How much you liked it', skip: 'Skip', save: 'Save',
  facesHard: 'Easy,Light,OK,Hard,Brutal', facesMind: 'Not at all,A little,Neutral,Quite,A lot', facesLike: 'Hated,Disliked,OK,Liked,Loved',
  saved: 'Saved', loading: 'Loading', fixedWindow: 'any time in the window', measured: 'timed', unplaced: 'Could not be placed',
  evenness: 'Evenness', ahead: 'ahead', behind: 'behind', even: 'Even', window28: 'last 28 days', dataQuestions: 'Data questions this week',
  letNexoPick: 'Let Nexo pick', nexoPickAbout: 'Nexo picks the nearest free time for the person who can do it.', orPickYourself: 'Or choose yourself', swapDeclined: 'Declined', swapFailed: 'The swap request did not go through. Try again.', swapSending: 'Sending', swapFromName: 'asks you to take', movedToWith: 'moved to',
  credit: 'Credit earned', swapAsk: 'Hand to', swapSent: 'Asked', swapOpen: 'Swap asked', accept: 'Accept', decline: 'Decline',
  out: 'I am out until', back: 'Back', away: 'Away', replan: 'Plan updated', baseline: 'How much do you mind each chore?', baselineAbout: 'One tap each. It decides who gets what.',
  add: 'Add', edit: 'Edit', name: 'Name', icon: 'Icon', category: 'Category', every: 'How often', times: 'times every', days: 'days', mode: 'Timing',
  modeFixed: 'Fixed window (not timed)', modeMeasured: 'Timed', priorMinutes: 'Minutes (first guess)', windowFrom: 'From', windowTo: 'To', active: 'Active', withDinnerWash: 'Done with the after-dinner wash', withWord: 'with',
  allowed: 'Who can do it', everyone: 'Anyone', weightOverride: 'Fixed weight (tama)', history: 'Changes', settings: 'Settings',
  share: 'Share of the work', buffer: 'Space around events (min)', freeze: 'Chores this close never move (min)', slot: 'Daily chore time', quiet: 'Quiet hours', burden: 'How much a chore you mind counts',
  adhoc: 'Not scheduled, logged when done', tidy: 'Tidy up',
  lists: 'Lists', newList: 'New list', addItem: 'Add an item, or paste several lines', clearDone: 'Clear done', noLists: 'No lists yet. Start with one of these.', listsAbout: 'Shared by both of you. Edits show up for the other person as they happen.',
  money: 'Money', owesYou: 'owes you', youOwe: 'you owe', allEven: 'All even', addExpense: 'Add expense', settleUp: 'Settle up', paidBy: 'Paid by', forWho: 'For', forBoth: 'Both', forOnly: 'Only', what: 'What for', amount: 'Amount (yen)', thisMonth: 'This month', spent: 'spent', settled: 'Settled', youPaid: 'you paid', theyPaid: 'paid', deleteEntry: 'Delete', moneyAbout: 'Shared by both of you. Balances come from the entries, so deleting one fixes everything.',
  finish: 'Finish', doneNoTimer: 'Done, no timer', recentDone: 'Done recently', rate: 'Rate', rated: 'Rated', comment: 'Comment', commentHint: 'Anything worth remembering (optional)', rateLater: 'You can also rate it later from the list below.',
  readings: 'Hiragana readings',
  ask: 'Ask Eduardo', askAbout: 'It lands on his board as a question. Nothing is done until he answers.', askKind: 'What kind?', askText: 'Write it in a line', askWhen: 'Which day?', askTime: 'Time (optional)', askSend: 'Send', askSent: 'Sent. He will see it on his board.', askShort: 'Write a little more.', askLong: 'Too long, keep it under 400 characters.', askNeedWhen: 'Pick a day.', myAsks: 'Your requests', askNew: 'sent', askDone: 'answered',
  move: 'Move', moveTitle: 'Move to a free slot', noSlots: 'No free slot in the next five days.', moved: 'Moved and pinned', pinned: 'Pinned',
  reschedule: 'Reschedule', dismiss: 'Dismiss', laterToday: 'Later today', thisEvening: 'This evening', tomorrow: 'Tomorrow', nextWeekend: 'Next weekend', pickTime: 'Pick another time', setTime: 'Move it',
  rescheduleAbout: 'Pick a new time. Kaji keeps it and learns from it.', whyOptional: 'Why? (optional)',
  dismissAbout: 'Not needed, or could not be finished. It will not be planned again today.', dismissWhy: 'Why? (required)', confirmDismiss: 'Dismiss it',
  reasonNot_needed: 'Not needed', reasonNo_time: 'No time', reasonNot_enough: 'Not enough to do', reasonDislike: 'I dislike it', reasonOther: 'Other', karmaNote: 'It goes to the other person today, and you owe half its weight, doubling if you skip it again within 14 days. Doing it once clears it.', karma: 'Karma owed', reasonText: 'Say why in a few words', dismissed: 'Dismissed', movedTo: 'Moved to', cancel: 'Cancel',
  quickRunning: 'Timing something', discard: 'Discard', whatDone: 'What did you do?', tookMin: 'Took', fixClock: 'forgot to stop? fix it', existingChore: 'A chore from the list', newChore: 'A new chore', customChore: 'Something one-off', customHint: 'Counted for this time only, not added to the list.', customName: 'What was it?', newChoreHint: 'Added to the Chores list, then logged.', saveLog: 'Save and log', logNoTimer: 'Log without a timer', startTimer: 'Start a timer',
  home: 'Home', whoIsHome: 'Who is home', goOut: 'Go out', backHome: 'Back home', atHome: 'At home', outUntil: 'Out until', byCalendar: 'calendar', you: 'you', mealsAtHome: 'Meals at home today', breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', both: 'both', eatOut: 'out',
  assumptions: 'Assumptions', assumptionsAbout: 'First guesses, to be corrected: meal times, how long a Go out lasts, and the karma for skipping a chore you dislike.', outDefault: 'Go out lasts (min)', karmaShareLabel: 'Karma per dislike skip (% of weight)', karmaDays: 'Repeat doubles within (days)', rebalanceLabel: 'Rebalance past (tama)',
  learnedTitle: 'Learned from your moves', learnedEarlier: 'window {m} min earlier, from {n} moves', learnedLater: 'window {m} min later, from {n} moves', learnedFreq: 'interval {x}x longer, from {n} dismissals',
};
export const DICT: Record<'en', Dict> = { en };

/** Kaji is English only. The language argument is kept so every caller still reads the same, and is ignored. */
export function t(_lang: Lang, key: string): string {
  return en[key] ?? key;
}
export function faces(lang: Lang, key: 'facesHard' | 'facesMind' | 'facesLike'): string[] {
  return t(lang, key).split(',');
}
export const CATEGORY_LABEL: Record<Category, string> = {
  kitchen: 'Kitchen', floors: 'Floors', rooms: 'Rooms', bathroom: 'Bathroom', laundry: 'Laundry', bed: 'Bed', shopping: 'Shopping', trash: 'Rubbish', tidy: 'Tidy',
};
