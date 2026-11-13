@echo off
start "" "http://localhost:8080"
powershell -ExecutionPolicy Bypass -File "%~dp0start-server.ps1"
