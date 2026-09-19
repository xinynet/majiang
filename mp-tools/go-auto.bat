@echo off
cd /d "C:\Program Files (x86)\Tencent\微信web开发者工具"
call cli.bat auto --project "C:\mydev\majiang\majiang-mp\dist\build\mp-weixin" --auto-port 9420 --lang zh
exit /b %ERRORLEVEL%
