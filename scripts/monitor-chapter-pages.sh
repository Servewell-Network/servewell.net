#!/usr/bin/env bash
# monitor-chapter-pages.sh
#
# Checks chapter 1 of each Bible book in turn, one every 30 seconds.
# Completes a full cycle (66 books) in ~33 minutes, then repeats.
# Alerts loudly on failure via macOS notification + voice + terminal bell.
#
# Usage:
#   bash scripts/monitor-chapter-pages.sh
#   bash scripts/monitor-chapter-pages.sh --interval 60   # slower polling
#   bash scripts/monitor-chapter-pages.sh --once           # single pass, exit 1 on any failure

set -euo pipefail

BASE_URL="https://servewell.net/-"
INTERVAL=30
ONCE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --interval) INTERVAL="$2"; shift 2 ;;
    --once)     ONCE=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

BOOKS=(
  "1-Chronicles"
  "1-Corinthians"
  "1-John"
  "1-Kings"
  "1-Peter"
  "1-Samuel"
  "1-Thessalonians"
  "1-Timothy"
  "2-Chronicles"
  "2-Corinthians"
  "2-John"
  "2-Kings"
  "2-Peter"
  "2-Samuel"
  "2-Thessalonians"
  "2-Timothy"
  "3-John"
  "Acts"
  "Amos"
  "Colossians"
  "Daniel"
  "Deuteronomy"
  "Ecclesiastes"
  "Ephesians"
  "Esther"
  "Exodus"
  "Ezekiel"
  "Ezra"
  "Galatians"
  "Genesis"
  "Habakkuk"
  "Haggai"
  "Hebrews"
  "Hosea"
  "Isaiah"
  "James"
  "Jeremiah"
  "Job"
  "Joel"
  "John"
  "Jonah"
  "Joshua"
  "Jude"
  "Judges"
  "Lamentations"
  "Leviticus"
  "Luke"
  "Malachi"
  "Mark"
  "Matthew"
  "Micah"
  "Nahum"
  "Nehemiah"
  "Numbers"
  "Obadiah"
  "Philemon"
  "Philippians"
  "Proverbs"
  "Psalms"
  "Revelation"
  "Romans"
  "Ruth"
  "Song-of-Songs"
  "Titus"
  "Zechariah"
  "Zephaniah"
)

TOTAL=${#BOOKS[@]}
fail_count=0

alert() {
  local book="$1" status="$2"
  local msg="ServeWell ALERT: /${book}/1 returned HTTP ${status}"
  echo ""
  echo "🚨  $msg"
  echo ""
  # macOS notification
  osascript -e "display notification \"${msg}\" with title \"ServeWell Monitor\" sound name \"Sosumi\"" 2>/dev/null || true
  # macOS voice
  say "Alert! Chapter page down. ${book} chapter 1 returned ${status}." 2>/dev/null || true
  # Terminal bell (3 times)
  printf '\a\a\a'
}

check_book() {
  local book="$1"
  local url="${BASE_URL}/${book}/1"
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url")
  local ts
  ts=$(date '+%H:%M:%S')
  if [[ "$status" == "200" ]]; then
    printf "  [%s] ✓  %-30s → %s\n" "$ts" "$book/1" "$status"
    return 0
  else
    printf "  [%s] ✗  %-30s → %s\n" "$ts" "$book/1" "$status"
    alert "$book" "$status"
    return 1
  fi
}

cycle=0
while true; do
  cycle=$((cycle + 1))
  fail_count=0
  echo ""
  echo "=== Cycle ${cycle} — $(date '+%Y-%m-%d %H:%M:%S') — checking ${TOTAL} books (${INTERVAL}s between each) ==="
  for book in "${BOOKS[@]}"; do
    if ! check_book "$book"; then
      fail_count=$((fail_count + 1))
    fi
    if $ONCE; then
      : # no sleep between checks in --once mode
    else
      sleep "$INTERVAL"
    fi
  done
  echo "--- Cycle ${cycle} complete. Failures: ${fail_count}/${TOTAL} ---"
  if $ONCE; then
    [[ "$fail_count" -eq 0 ]] && exit 0 || exit 1
  fi
done
