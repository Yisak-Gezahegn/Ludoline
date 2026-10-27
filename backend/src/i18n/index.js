/**
 * Ludoline i18n – English, Amharic, Afaan Oromo
 */

const translations = {
  en: {
    // Auth
    otp_sent: 'OTP sent to your phone',
    otp_invalid: 'Invalid or expired OTP',
    otp_max_attempts: 'Too many OTP requests. Try again in 1 hour.',
    phone_already_registered: 'This phone number is already registered',
    login_success: 'Welcome back!',
    register_success: 'Account created successfully',
    profile_incomplete: 'Please complete your profile',

    // Wallet
    deposit_initiated: 'Deposit initiated. Complete payment on Telebirr.',
    deposit_success: 'Deposit successful',
    deposit_failed: 'Deposit failed. Please try again.',
    withdraw_initiated: 'Withdrawal request submitted',
    withdraw_success: 'Withdrawal sent to your Telebirr account',
    insufficient_balance: 'Insufficient balance',
    min_bet_error: 'Minimum bet is {min} ETB',
    max_bet_error: 'Maximum bet is {max} ETB',

    // Room
    room_created: 'Room created successfully',
    room_not_found: 'Room not found',
    room_full: 'Room is full',
    room_started: 'Game has already started',
    joined_room: 'You joined the room',
    left_room: 'You left the room',
    not_enough_players: 'Waiting for more players...',

    // Game
    your_turn: "It's your turn!",
    roll_dice: 'Roll the dice',
    no_moves: 'No moves available. Skipping turn.',
    piece_killed: 'Your piece was sent back!',
    you_killed: 'You sent a piece back!',
    three_sixes: 'Three sixes! Turn forfeited.',
    extra_turn: 'You got an extra turn!',
    you_won: '🎉 You won! Prize: {amount} ETB',
    you_came_second: '🥈 2nd place! Prize: {amount} ETB',
    you_came_third: '🥉 3rd place! Prize: {amount} ETB',
    you_lost: 'Better luck next time!',
    game_abandoned: 'Game abandoned due to inactivity',

    // General
    error_generic: 'Something went wrong. Please try again.',
    unauthorized: 'Please login to continue',
    forbidden: 'You do not have permission to do that'
  },

  am: {
    // Auth (Amharic)
    otp_sent: 'OTP ወደ ስልክዎ ተልኳል',
    otp_invalid: 'OTP ትክክል አይደለም ወይም ጊዜው አልፏል',
    otp_max_attempts: 'ብዙ ጊዜ ሞክረዋል። ከ1 ሰዓት በኋላ ይሞክሩ።',
    phone_already_registered: 'ይህ ስልክ ቁጥር አስቀድሞ ተመዝግቧል',
    login_success: 'እንኳን ደህና መጡ!',
    register_success: 'መለያ በተሳካ ሁኔታ ተፈጥሯል',
    profile_incomplete: 'እባክዎ መገለጫዎን ያጠናቅቁ',

    // Wallet
    deposit_initiated: 'ቴሌብር ላይ ክፍያ ይፈጽሙ',
    deposit_success: 'ገንዘብ ተቀምጧል',
    deposit_failed: 'ወደ መለያ ማስገባት አልተሳካም',
    withdraw_initiated: 'የገንዘብ ማስወጣት ጥያቄ ተልኳል',
    withdraw_success: 'ገንዘቡ ወደ ቴሌብር ተልኳል',
    insufficient_balance: 'በቂ ሂሳብ የለም',
    min_bet_error: 'አነስተኛ ውርርድ {min} ብር ነው',
    max_bet_error: 'ከፍተኛ ውርርድ {max} ብር ነው',

    // Room
    room_created: 'ክፍሉ ተፈጥሯል',
    room_not_found: 'ክፍሉ አልተገኘም',
    room_full: 'ክፍሉ ሞልቷል',
    room_started: 'ጨዋታ ተጀምሯል',
    joined_room: 'ወደ ክፍሉ ገቡ',
    left_room: 'ክፍሉን ለቀዋል',
    not_enough_players: 'ሌሎች ተጫዋቾች እየጠበቀ ነው...',

    // Game
    your_turn: 'ተራዎ ነው!',
    roll_dice: 'ዳይስ ይጣሉ',
    no_moves: 'ሊደረግ የሚችል እንቅስቃሴ የለም። ተራ ተዘሏል።',
    piece_killed: 'ቁርስዎ ወደ ቤት ተመለሰ!',
    you_killed: 'የተቃዋሚ ቁርስ ወደ ቤት ላኩ!',
    three_sixes: 'ሶስት ስድስት! ተራ ጠፋ።',
    extra_turn: 'ተጨማሪ ተራ አገኙ!',
    you_won: '🎉 አሸነፉ! ሽልማት: {amount} ብር',
    you_came_second: '🥈 ሁለተኛ! ሽልማት: {amount} ብር',
    you_came_third: '🥉 ሶስተኛ! ሽልማት: {amount} ብር',
    you_lost: 'ሌላ ጊዜ ይሞክሩ!',
    game_abandoned: 'ጨዋታ በእንቅስቃሴ ማጣት ተቋርጧል',

    // General
    error_generic: 'ችግር ተፈጥሯል። እንደገና ይሞክሩ።',
    unauthorized: 'ለመቀጠል ይግቡ',
    forbidden: 'ፍቃድ የለዎትም'
  },

  or: {
    // Auth (Afaan Oromo)
    otp_sent: 'OTP lakkoofsa bilbilaa keessan erginame',
    otp_invalid: 'OTP sirrii miti yookiin yeroon isaa darbe',
    otp_max_attempts: 'Yaalii baay\'ee godhan. Booda daqiiqaa 60 booda yaali.',
    phone_already_registered: 'Lakkoofsi bilbilaa kun dursee galmaa\'eera',
    login_success: 'Baga nagaan deebi\'attan!',
    register_success: 'Herreega milkii\'inaan uumame',
    profile_incomplete: 'Maaloo profaayilii keessan guutaa',

    // Wallet
    deposit_initiated: 'Kaffaltii Telebirr irratti xumurii',
    deposit_success: 'Maallaqni galmeessame',
    deposit_failed: 'Maallaqni galchuun hin milkoofne',
    withdraw_initiated: 'Gaaffiin kaasuu ergameera',
    withdraw_success: 'Maallaqni gara Telebirr keessanitti ergameera',
    insufficient_balance: 'Balansi gahaa miti',
    min_bet_error: 'Xiqqaan bahii {min} ETB',
    max_bet_error: 'Guddaan bahii {max} ETB',

    // Room
    room_created: 'Kutaan milkii\'inaan uumame',
    room_not_found: 'Kutaan hin argamne',
    room_full: 'Kutaan guuteedha',
    room_started: 'Taphi jalqabame',
    joined_room: 'Kutaa seentan',
    left_room: 'Kutaa gad-dhiistan',
    not_enough_players: 'Taphattoota biroo eegaa...',

    // Game
    your_turn: 'Tarree keessanitti!',
    roll_dice: 'Daayisii darbaa',
    no_moves: 'Socho\'uun hin danda\'amu. Tarreen ce\'ame.',
    piece_killed: 'Qabatamni keessan gara manaatti deebifame!',
    you_killed: 'Qabatama dorgommii gara manaatti ergitan!',
    three_sixes: 'Jahaafi sadi! Tarreen dhabe.',
    extra_turn: 'Tarree dabalataa argattan!',
    you_won: '🎉 Mo\'attan! Badhaasa: {amount} ETB',
    you_came_second: '🥈 Lammaffaa! Badhaasa: {amount} ETB',
    you_came_third: '🥉 Sadaffaa! Badhaasa: {amount} ETB',
    you_lost: 'Carraa gaarii yeroo itti aanu!',
    game_abandoned: 'Taphi socho\'uun dhabamuu irraan harcaatee',

    // General
    error_generic: 'Rakkoo uumame. Maaloo irra deebi\'ii yaalii.',
    unauthorized: 'Itti fuufuuf seena',
    forbidden: 'Hayyama hin qabdan'
  }
};

/**
 * Get a translated string.
 * @param {string} lang - 'en' | 'am' | 'or'
 * @param {string} key
 * @param {object} vars - optional replacement variables like { amount: 100 }
 */
function t(lang, key, vars = {}) {
  const langData = translations[lang] || translations.en;
  let text = langData[key] || translations.en[key] || key;
  Object.entries(vars).forEach(([k, v]) => {
    text = text.replace(`{${k}}`, v);
  });
  return text;
}

module.exports = { t, translations };
