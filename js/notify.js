export function generateMatchAlert({ homePlayer, awayPlayer, date, time, joinCode }) {
  const msg = `📢 *eLeague Manager*\nMatch Alert! ⚽\n🆚 ${homePlayer} vs ${awayPlayer}\n📅 ${date}\n⏰ ${time}\n🔑 Join Code: ${joinCode}\nGood luck! 🏆`;
  const encoded = encodeURIComponent(msg);
  return `https://wa.me/?text=${encoded}`;
}

export function generateResultAlert({ homePlayer, awayPlayer, homeScore, awayScore, phase }) {
  const winner = homeScore > awayScore ? homePlayer : homeScore < awayScore ? awayPlayer : null;
  const resultLine = winner ? `🏆 Winner: ${winner}` : `🤝 Match Drawn`;
  const phaseLabels = { group:'Group Stage', r32:'Round of 32', r16:'Round of 16', qf:'Quarter-final', sf:'Semi-final', '3rd':'3rd Place', final:'Final' };
  const phaseLabel = phaseLabels[phase] || phase || 'Match';
  const msg = `⚽ *eLeague Manager — Match Result*\n\n📋 ${phaseLabel}\n\n${homePlayer}  ${homeScore} – ${awayScore}  ${awayPlayer}\n\n${resultLine}`;
  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

export function generateWinnerAlert({ first, second, third }) {
  const msg = `🏆 *eLeague Manager — Tournament Over!*\n\n🥇 Champion: ${first}\n🥈 Runner-up: ${second}\n🥉 Third place: ${third}\n\nCongratulations to all players! ⚽`;
  const encoded = encodeURIComponent(msg);
  return `https://wa.me/?text=${encoded}`;
}
