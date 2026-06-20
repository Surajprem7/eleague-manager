export function generateMatchAlert({ homePlayer, awayPlayer, date, time, joinCode }) {
  const msg = `📢 *eLeague Manager*\nMatch Alert! ⚽\n🆚 ${homePlayer} vs ${awayPlayer}\n📅 ${date}\n⏰ ${time}\n🔑 Join Code: ${joinCode}\nGood luck! 🏆`;
  const encoded = encodeURIComponent(msg);
  return `https://wa.me/?text=${encoded}`;
}

export function generateWinnerAlert({ first, second, third }) {
  const msg = `🏆 *eLeague Manager — Tournament Over!*\n\n🥇 Champion: ${first}\n🥈 Runner-up: ${second}\n🥉 Third place: ${third}\n\nCongratulations to all players! ⚽`;
  const encoded = encodeURIComponent(msg);
  return `https://wa.me/?text=${encoded}`;
}
