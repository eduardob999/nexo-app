import type { Category, Lang } from './model';

type Dict = Record<string, string>;
const en: Dict = {
  kaji: 'Kaji', kajiSub: 'Housework, shared fairly',
  today: 'Today', week: 'Week', balance: 'Balance', chores: 'Chores', more: 'More',
  create: 'Create our household', join: 'Join', householdName: 'Household name', yourName: 'Your name', language: 'Language',
  setupAbout: 'Kaji splits the housework by how much each of you minds it, not only by minutes. Everything is editable.',
  inviteTitle: 'Invite the other person', inviteAbout: 'Type the Google address they sign in with. They open Nexo and tap Join.', invite: 'Invite', invited: 'Invited',
  joinTitle: 'You are invited', joinAbout: 'Join this household to see and share the chores.',
  start: 'Start', done: 'Done', stop: 'Stop', notToday: 'Not today', swap: 'Swap', later: 'Later', undo: 'Undo',
  nothingToday: 'Nothing left for you today.', nothingTodayHelp: 'Enjoy it. Anything you do anyway can be logged with the plus.',
  yourChores: 'Your chores', theirChores: 'Their chores', running: 'Running', minutes: 'min', tama: 'tama',
  logAChore: 'Log a chore', logAbout: 'Anything you did, planned or not.', howLong: 'How long, about?', whichOne: 'Which chore?',
  rateTitle: 'How was it?', effort: 'How hard', mind: 'How much you minded', enjoy: 'How much you liked it', skip: 'Skip', save: 'Save',
  facesHard: 'Easy,Light,OK,Hard,Brutal', facesMind: 'Not at all,A little,Neutral,Quite,A lot', facesLike: 'Hated,Disliked,OK,Liked,Loved',
  saved: 'Saved', loading: 'Loading', fixedWindow: 'any time in the window', measured: 'timed', unplaced: 'Could not be placed',
  evenness: 'Evenness', ahead: 'ahead', behind: 'behind', even: 'Even', window28: 'last 28 days', dataQuestions: 'Data questions this week',
  credit: 'Credit earned', swapAsk: 'Hand to', swapSent: 'Asked', swapOpen: 'Swap asked', accept: 'Accept', decline: 'Decline',
  out: 'I am out until', back: 'Back', away: 'Away', replan: 'Plan updated', baseline: 'How much do you mind each chore?', baselineAbout: 'One tap each. It decides who gets what.',
  add: 'Add', edit: 'Edit', name: 'Name', icon: 'Icon', category: 'Category', every: 'How often', times: 'times every', days: 'days', mode: 'Timing',
  modeFixed: 'Fixed window (not timed)', modeMeasured: 'Timed', priorMinutes: 'Minutes (first guess)', windowFrom: 'From', windowTo: 'To', active: 'Active',
  allowed: 'Who can do it', everyone: 'Anyone', weightOverride: 'Fixed weight (tama)', history: 'Changes', settings: 'Settings',
  share: 'Share of the work', buffer: 'Space around events (min)', freeze: 'Chores this close never move (min)', slot: 'Daily chore time', quiet: 'Quiet hours', burden: 'How much a chore you mind counts',
  adhoc: 'Not scheduled, logged when done', tidy: 'Tidy up',
};
const es: Dict = {
  kaji: 'Kaji', kajiSub: 'Las tareas del hogar, repartidas con justicia',
  today: 'Hoy', week: 'Semana', balance: 'Balance', chores: 'Tareas', more: 'Más',
  create: 'Crear nuestro hogar', join: 'Unirme', householdName: 'Nombre del hogar', yourName: 'Tu nombre', language: 'Idioma',
  setupAbout: 'Kaji reparte las tareas según cuánto le molesta a cada quien, no solo por minutos. Todo se puede editar.',
  inviteTitle: 'Invita a la otra persona', inviteAbout: 'Escribe el correo de Google con el que entra. Abre Nexo y toca Unirme.', invite: 'Invitar', invited: 'Invitada',
  joinTitle: 'Te invitaron', joinAbout: 'Únete a este hogar para ver y compartir las tareas.',
  start: 'Empezar', done: 'Listo', stop: 'Parar', notToday: 'Hoy no', swap: 'Cambiar', later: 'Después', undo: 'Deshacer',
  nothingToday: 'Hoy ya no te queda nada.', nothingTodayHelp: 'Disfrútalo. Lo que hagas igual se anota con el más.',
  yourChores: 'Tus tareas', theirChores: 'Sus tareas', running: 'En marcha', minutes: 'min', tama: 'tama',
  logAChore: 'Anotar una tarea', logAbout: 'Cualquier cosa que hiciste, planeada o no.', howLong: '¿Cuánto tardó, más o menos?', whichOne: '¿Cuál tarea?',
  rateTitle: '¿Cómo estuvo?', effort: 'Qué tan difícil', mind: 'Cuánto te molestó', enjoy: 'Cuánto te gustó', skip: 'Saltar', save: 'Guardar',
  facesHard: 'Fácil,Ligera,Normal,Dura,Brutal', facesMind: 'Nada,Poco,Normal,Bastante,Mucho', facesLike: 'Odié,No me gustó,Normal,Me gustó,Me encantó',
  saved: 'Guardado', loading: 'Cargando', fixedWindow: 'a cualquier hora de la ventana', measured: 'con cronómetro', unplaced: 'No cupo',
  evenness: 'Equilibrio', ahead: 'por delante', behind: 'por detrás', even: 'Parejo', window28: 'últimos 28 días', dataQuestions: 'Preguntas de datos esta semana',
  credit: 'Crédito ganado', swapAsk: 'Pasar a', swapSent: 'Pedido', swapOpen: 'Cambio pedido', accept: 'Aceptar', decline: 'Rechazar',
  out: 'No estoy hasta', back: 'Volví', away: 'Fuera', replan: 'Plan actualizado', baseline: '¿Cuánto te molesta cada tarea?', baselineAbout: 'Un toque por tarea. Decide quién hace qué.',
  add: 'Añadir', edit: 'Editar', name: 'Nombre', icon: 'Icono', category: 'Categoría', every: 'Cada cuánto', times: 'veces cada', days: 'días', mode: 'Tiempo',
  modeFixed: 'Ventana fija (sin cronómetro)', modeMeasured: 'Con cronómetro', priorMinutes: 'Minutos (primera idea)', windowFrom: 'Desde', windowTo: 'Hasta', active: 'Activa',
  allowed: 'Quién puede hacerla', everyone: 'Cualquiera', weightOverride: 'Peso fijo (tama)', history: 'Cambios', settings: 'Ajustes',
  share: 'Parte del trabajo', buffer: 'Espacio alrededor de los eventos (min)', freeze: 'Tareas tan cercanas no se mueven (min)', slot: 'Hora diaria de tareas', quiet: 'Horas de silencio', burden: 'Cuánto pesa una tarea que te molesta',
  adhoc: 'Sin horario, se anota al hacerla', tidy: 'Ordenar',
};
const ja: Dict = {
  kaji: '家事', kajiSub: '家事を公平に分け合う',
  today: '今日', week: '週', balance: 'バランス', chores: '家事一覧', more: 'その他',
  create: '私たちの家を作る', join: '参加', householdName: '家の名前', yourName: 'あなたの名前', language: '言語',
  setupAbout: '家事を時間だけでなく、それぞれの負担感で分けます。すべて編集できます。',
  inviteTitle: 'もう一人を招待', inviteAbout: 'ログインに使うGoogleのアドレスを入力。Nexoを開いて参加を押します。', invite: '招待', invited: '招待済み',
  joinTitle: '招待されています', joinAbout: 'この家に参加すると家事を見て共有できます。',
  start: '開始', done: '完了', stop: '停止', notToday: '今日はなし', swap: '交代', later: '後で', undo: '元に戻す',
  nothingToday: '今日はもうありません。', nothingTodayHelp: 'ゆっくりどうぞ。やったことは＋で記録できます。',
  yourChores: 'あなたの家事', theirChores: '相手の家事', running: '計測中', minutes: '分', tama: '玉',
  logAChore: '家事を記録', logAbout: '予定外でもやったことを記録します。', howLong: 'どのくらいかかった？', whichOne: 'どの家事？',
  rateTitle: 'どうでしたか', effort: '大変さ', mind: '嫌さ', enjoy: '好き度', skip: 'スキップ', save: '保存',
  facesHard: '楽,軽い,普通,大変,きつい', facesMind: '全く,少し,普通,かなり,とても', facesLike: '嫌い,苦手,普通,好き,大好き',
  saved: '保存しました', loading: '読み込み中', fixedWindow: '時間帯の中でいつでも', measured: '計測', unplaced: '入りませんでした',
  evenness: '均等度', ahead: '多め', behind: '少なめ', even: '均等', window28: '直近28日', dataQuestions: '今週のデータ質問',
  credit: '獲得クレジット', swapAsk: '渡す相手', swapSent: '依頼済み', swapOpen: '交代の依頼', accept: '受ける', decline: '断る',
  out: '不在期間', back: '戻りました', away: '不在', replan: '予定を更新', baseline: '各家事がどれくらい嫌ですか？', baselineAbout: 'ひとつずつタップ。担当決めに使います。',
  add: '追加', edit: '編集', name: '名前', icon: 'アイコン', category: '分類', every: '頻度', times: '回 / ', days: '日', mode: '時間',
  modeFixed: '時間帯固定（計測なし）', modeMeasured: '計測する', priorMinutes: '分（最初の目安）', windowFrom: '開始', windowTo: '終了', active: '有効',
  allowed: '担当できる人', everyone: '誰でも', weightOverride: '固定の重み（玉）', history: '変更履歴', settings: '設定',
  share: '分担の割合', buffer: '予定の前後の余白（分）', freeze: 'この時間内の家事は動かさない（分）', slot: '毎日の家事の時間', quiet: '静かな時間', burden: '嫌な家事の重み',
  adhoc: '予定なし、やったら記録', tidy: '片付け',
};
export const DICT: Record<Lang, Dict> = { en, es, ja };

export function t(lang: Lang, key: string): string {
  return DICT[lang][key] ?? en[key] ?? key;
}
export function faces(lang: Lang, key: 'facesHard' | 'facesMind' | 'facesLike'): string[] {
  return t(lang, key).split(',');
}
export const CATEGORY_LABEL: Record<Category, Names3> = {
  kitchen: { en: 'Kitchen', es: 'Cocina', ja: 'キッチン' }, floors: { en: 'Floors', es: 'Pisos', ja: '床' }, rooms: { en: 'Rooms', es: 'Cuartos', ja: '部屋' },
  bathroom: { en: 'Bathroom', es: 'Baño', ja: '浴室' }, laundry: { en: 'Laundry', es: 'Ropa', ja: '洗濯' }, bed: { en: 'Bed', es: 'Cama', ja: '寝具' },
  shopping: { en: 'Shopping', es: 'Compras', ja: '買い物' }, trash: { en: 'Rubbish', es: 'Basura', ja: 'ゴミ' }, tidy: { en: 'Tidy', es: 'Orden', ja: '片付け' },
};
type Names3 = Record<Lang, string>;
