on run
  set projectDirectory to "/Users/thanh/PHAN MEM/Dovehientruong"
  set localUrl to "http://127.0.0.1:5180/#map"
  set healthUrl to "http://127.0.0.1:5180/"
  set startCommand to "cd " & quoted form of projectDirectory & " && /usr/bin/nohup /Users/thanh/.npm-global/bin/pnpm dev >/tmp/dove-hien-truong-local.log 2>&1 &"

  try
    do shell script "/usr/bin/curl --fail --silent --max-time 1 " & quoted form of healthUrl & " >/dev/null"
  on error
    do shell script startCommand
    repeat with attempt from 1 to 90
      delay 1
      try
        do shell script "/usr/bin/curl --fail --silent --max-time 1 " & quoted form of healthUrl & " >/dev/null"
        exit repeat
      end try
    end repeat
  end try

  do shell script "/usr/bin/open " & quoted form of localUrl
end run
