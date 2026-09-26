# Functii comune pentru start/stop/status (sourced).
DEMO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$DEMO_DIR/../../.." && pwd)"
LOGS="$DEMO_DIR/logs"
PIDS="$DEMO_DIR/data/pids"
mkdir -p "$LOGS" "$PIDS" "$DEMO_DIR/data/redis"

port_open() { (echo > "/dev/tcp/127.0.0.1/$1") >/dev/null 2>&1; }

wait_port() { # wait_port <port> <secunde> <nume>
  local i
  for ((i = 0; i < $2; i++)); do port_open "$1" && return 0; sleep 1; done
  echo "  !! $3 nu a pornit pe :$1 in $2s (vezi $LOGS)"; return 1
}

pid_alive() { [ -f "$PIDS/$1.pid" ] && kill -0 "$(cat "$PIDS/$1.pid")" 2>/dev/null; }

# start_bg <nume> <port> <comanda...> — porneste detasat (setsid) daca portul e liber
start_bg() {
  local name="$1" port="$2"; shift 2
  if port_open "$port"; then echo "  = $name deja activ pe :$port"; return 0; fi
  # comanda simpla in fundal → copilul face exec direct in setsid (fara subshell care sa tina
  # deschis stdout-ul apelantului); setsid → sesiune/grup nou, deci stop poate omori tot grupul
  pushd "$DEMO_DIR" >/dev/null
  setsid nohup "$@" >>"$LOGS/$name.log" 2>&1 < /dev/null &
  echo $! > "$PIDS/$name.pid"
  popd >/dev/null
  echo "  + $name pornit (pid $(cat "$PIDS/$name.pid"), log logs/$name.log)"
}

# stop_bg <nume> <port> — omoara grupul de procese + orice asculta pe port
stop_bg() {
  local name="$1" port="$2" pid
  if [ -f "$PIDS/$name.pid" ]; then
    pid="$(cat "$PIDS/$name.pid")"
    kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null
    rm -f "$PIDS/$name.pid"
  fi
  if [ -n "$port" ]; then
    local i
    for i in 1 2 3 4 5 6 7 8 9 10; do port_open "$port" || break; sleep 1; done
    port_open "$port" && fuser -k -TERM "$port/tcp" >/dev/null 2>&1
    sleep 1; port_open "$port" && fuser -k -KILL "$port/tcp" >/dev/null 2>&1
  fi
  port_open "$port" && echo "  !! $name inca asculta pe :$port" || echo "  - $name oprit"
}
