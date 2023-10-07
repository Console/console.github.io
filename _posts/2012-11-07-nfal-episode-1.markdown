---
layout: post
title:  "Notes from a lockdown: Episode 1"
date:   2012-11-07 00:00:00 +0000
categories: blog
---
So I’ve done a few posts in the past about getting command prompts from GPO’d workstations and running what’s known as “mobile code” in locked down environments (##, VBS, BAT, Bash, Python, Perl, etc…).

I figured I’d try and make a series of shorter posts maybe detailing some of the things I’ve discovered while working on my current long term engagement (involves lots of local lockdown playtime).

## Just because you can’t run reg edit doesn’t mean you can’t edit reg

The following methods can all be used to edit registry keys, create full trees down to a value or otherwise modify the registry.

### VBS – Difficulty: Easy

```
function writeReg(regPath,value,regType)

    'reg_sz = String, reg_dword = integer, reg_binary = binary or boolean

    'reg_expand_sz = expandable string (like a path of %systemroot%), reg_sz = string

    Dim objReg, keySet

    objReg = CreateObject("WScript.Shell")

    key = objReg.regWrite(regPath,Value,RegType)

    writeReg = key

End Function

'Now to call the function above.

disposablevar = writeReg("HKCU/scriptmonkey/regwriting/1","Success!","REG_SZ")
```

### VBA – Difficulty: Easy (depending on lockdown of office suite, see: Getting Prompts & Fun with macros for details of circumventing that)

```
'This all relies upon a small function available within word called privateprofilestring.

Sub regReaderEditor

    'To Write

    System.PrivateProfileString("", _   "HKEY_CURRENT_USER/scriptmonkey/regwriting","2") = "Success!!"

    'To Read

    disposableVar = System.PrivateProfileString("","HKEY_CURRENT_USER/scriptmonkey/regwriting","2")

    msgbox disposableVar

End Sub
```

### VBS with WMI – Difficulty: Could end up in a moment of WTF?

The reason for the difficulty increase?

The way that WMI handles registry writing by calling different functions for different types of registry key that you wish to write, It also involves scary hexadecimal numbers to refer to the various hives. I can barely count to 10, let alone F.

The script snippet that follows is available in better syntax highlighting glory along with a bunch of other interesting WMI scripts over on the MSDN documentation pages, so go and check them out when you have time, but this is one i’ve used in the past with success.

```
Const HKEY_LOCAL_MACHINE = &H80000002

strKeyPath = "scriptmonkey/regediting/"

strComputer = "."

Set objReg=GetObject( "winmgmts:{impersonationLevel=impersonate}!" & _ strComputer & "rootdefault:StdRegProv")

strValueName = "3"

strValue = "Success!!!"

objReg.SetStringValue HKEY_LOCAL_MACHINE,strKeyPath,strValueName,strValue

Script.Echo "Example String_Value at " _& "HKEY_LOCAL_MACHINE/scriptmonkey/regediting"
```