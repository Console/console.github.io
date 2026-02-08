Option Explicit

' Demo: create an MSI with Type 6 VBScript custom actions.
' - Runs once very early ("Pre-UI") before any authored UI dialogs.
' - Runs again later in the UI sequence ("UI").
' - Also runs the Pre-UI action in ExecuteSequence for /qn (no MsgBox; logs only).
'
' Notes:
' - MSI custom actions cannot run before Windows Installer policy checks.
' - Type 6 is an immediate custom action; avoid doing privileged work here.

Private Const msiOpenDatabaseModeCreate As Long = 3
Private Const CA_TYPE_VBSCRIPT_BINARY As Long = 6

' -----------------
' Configuration
' -----------------
' Set these to override defaults. Keep them empty ("") for portable defaults.
Private Const CFG_OUTPUT_DIR As String = ""  ' Default: CurDir$
Private Const CFG_TEMP_DIR As String = ""    ' Default: Environ$("TEMP")

Private Const CFG_MSI_DEMO_NAME As String = "DemoType6_CA.msi"
Private Const CFG_MSI_SCRIPT_ONLY_NAME As String = "DemoType6_ScriptOnly.msi"

Private Const CFG_LOG_DEMO_NAME As String = "demo_msi.log"
Private Const CFG_LOG_SCRIPT_ONLY_NAME As String = "script_only.log"
#If VBA7 Then
    Private Declare PtrSafe Function CoCreateGuid Lib "ole32.dll" (ByRef pguid As GUID) As Long
    Private Declare PtrSafe Function StringFromGUID2 Lib "ole32.dll" (ByRef rguid As GUID, ByVal lpsz As LongPtr, ByVal cchMax As Long) As Long
#Else
    Private Declare Function CoCreateGuid Lib "ole32.dll" (ByRef pguid As GUID) As Long
    Private Declare Function StringFromGUID2 Lib "ole32.dll" (ByRef rguid As GUID, ByVal lpsz As Long, ByVal cchMax As Long) As Long
#End If
Private Type GUID
    Data1 As Long
    Data2 As Integer
    Data3 As Integer
    Data4(0 To 7) As Byte
End Type
Public Sub Demo_CreateMsiInCurrentDir()
    Dim msiPath As String
    msiPath = BuildOutputPath(CFG_MSI_DEMO_NAME)

    CreateDemoMsiWithType6CAs msiPath

    MsgBox "Created: " & msiPath & vbCrLf & vbCrLf & _
           "Try:" & vbCrLf & _
           "  msiexec /i """ & msiPath & """" & vbCrLf & _
           "  msiexec /i """ & msiPath & """ /qn /l*v """ & BuildTempPath(CFG_LOG_DEMO_NAME) & """", vbInformation
End Sub

Public Sub Demo_InstallMsiFromCurrentDir()
    Dim msiPath As String
    msiPath = BuildOutputPath(CFG_MSI_DEMO_NAME)

    Dim sh As Object: Set sh = CreateObject("WScript.Shell")
    sh.Run "msiexec /i """ & msiPath & """", 1, False
End Sub

' Creates an MSI that only runs the VBScript CAs and does not install/register a product.
' It will execute custom actions, then exit successfully without writing files/registry.
Public Sub Demo_CreateScriptOnlyMsiInCurrentDir()
    Dim msiPath As String
    msiPath = BuildOutputPath(CFG_MSI_SCRIPT_ONLY_NAME)

    CreateScriptOnlyMsiWithType6CAs msiPath

    MsgBox "Created: " & msiPath & vbCrLf & vbCrLf & _
           "Try:" & vbCrLf & _
           "  msiexec /i """ & msiPath & """" & vbCrLf & _
           "  msiexec /i """ & msiPath & """ /qn /l*v """ & BuildTempPath(CFG_LOG_SCRIPT_ONLY_NAME) & """", vbInformation
End Sub

Private Sub CreateDemoMsiWithType6CAs(ByVal outMsiPath As String)
    Const productName As String = "VBA CA Demo"
    Const manufacturer As String = "Example Co"
    Const productVersion As String = "1.0.0"

    Dim productCode As String: productCode = NewGuidBraced()
    Dim upgradeCode As String: upgradeCode = NewGuidBraced()
    Dim packageCode As String: packageCode = NewGuidBraced()

    Dim installer As Object: Set installer = CreateObject("WindowsInstaller.Installer")
    Dim db As Object: Set db = installer.OpenDatabase(outMsiPath, msiOpenDatabaseModeCreate)

    ' Core tables for a minimal install (writes one HKCU registry value)
    ' Windows Installer SQL DDL requires PRIMARY KEY at the end of the column list,
    ' and it must not be preceded by a comma.
    ExecSql installer, db, "CREATE TABLE `Property` (`Property` CHAR(72) NOT NULL, `Value` LONGCHAR PRIMARY KEY `Property`)"
    ExecSql installer, db, "CREATE TABLE `Directory` (`Directory` CHAR(72) NOT NULL, `Directory_Parent` CHAR(72), `DefaultDir` CHAR(255) NOT NULL PRIMARY KEY `Directory`)"
    ExecSql installer, db, "CREATE TABLE `Feature` (`Feature` CHAR(38) NOT NULL, `Feature_Parent` CHAR(38), `Title` CHAR(64), `Description` CHAR(255), `Display` SHORT, `Level` SHORT NOT NULL, `Directory_` CHAR(72), `Attributes` SHORT PRIMARY KEY `Feature`)"
    ExecSql installer, db, "CREATE TABLE `Component` (`Component` CHAR(72) NOT NULL, `ComponentId` CHAR(38), `Directory_` CHAR(72) NOT NULL, `Attributes` SHORT NOT NULL, `Condition` CHAR(255), `KeyPath` CHAR(72) PRIMARY KEY `Component`)"
    ExecSql installer, db, "CREATE TABLE `FeatureComponents` (`Feature_` CHAR(38) NOT NULL, `Component_` CHAR(72) NOT NULL PRIMARY KEY `Feature_`, `Component_`)"
    ExecSql installer, db, "CREATE TABLE `Registry` (`Registry` CHAR(72) NOT NULL, `Root` SHORT NOT NULL, `Key` CHAR(255) NOT NULL, `Name` CHAR(255), `Value` LONGCHAR, `Component_` CHAR(72) NOT NULL PRIMARY KEY `Registry`)"
    ExecSql installer, db, "CREATE TABLE `InstallExecuteSequence` (`Action` CHAR(72) NOT NULL, `Condition` CHAR(255), `Sequence` SHORT PRIMARY KEY `Action`)"
    ExecSql installer, db, "CREATE TABLE `InstallUISequence` (`Action` CHAR(72) NOT NULL, `Condition` CHAR(255), `Sequence` SHORT PRIMARY KEY `Action`)"
    ExecSql installer, db, "CREATE TABLE `Media` (`DiskId` SHORT NOT NULL, `LastSequence` LONG NOT NULL, `DiskPrompt` CHAR(64), `Cabinet` CHAR(255), `VolumeLabel` CHAR(32), `Source` CHAR(72) PRIMARY KEY `DiskId`)"
    ExecSql installer, db, "CREATE TABLE `File` (`File` CHAR(72) NOT NULL, `Component_` CHAR(72) NOT NULL, `FileName` CHAR(255) NOT NULL, `FileSize` LONG NOT NULL, `Version` CHAR(72), `Language` CHAR(20), `Attributes` SHORT, `Sequence` LONG NOT NULL PRIMARY KEY `File`)"
    ExecSql installer, db, "CREATE TABLE `MsiAssembly` (`Component_` CHAR(72) NOT NULL, `Feature_` CHAR(38) NOT NULL, `File_Application` CHAR(72) NOT NULL, `File_Manifest` CHAR(72), `Attributes` SHORT NOT NULL PRIMARY KEY `Component_`)"
    ExecSql installer, db, "CREATE TABLE `Error` (`Error` SHORT NOT NULL, `Message` CHAR(255) NOT NULL PRIMARY KEY `Error`)"
    ExecSql installer, db, "CREATE TABLE `LaunchCondition` (`Condition` CHAR(255) NOT NULL, `Description` CHAR(255) PRIMARY KEY `Condition`)"

    ' Custom action tables
    ExecSql installer, db, "CREATE TABLE `Binary` (`Name` CHAR(72) NOT NULL, `Data` OBJECT NOT NULL PRIMARY KEY `Name`)"
    ExecSql installer, db, "CREATE TABLE `CustomAction` (`Action` CHAR(72) NOT NULL, `Type` SHORT NOT NULL, `Source` CHAR(72), `Target` CHAR(255) PRIMARY KEY `Action`)"

    ' Required product properties
    InsProp installer, db, "ProductName", productName
    InsProp installer, db, "Manufacturer", manufacturer
    InsProp installer, db, "ProductVersion", productVersion
    InsProp installer, db, "ProductLanguage", "1033"
    InsProp installer, db, "ProductCode", productCode
    InsProp installer, db, "UpgradeCode", upgradeCode
    
    ' Force per-user install by default (no UAC prompt when package is per-user safe).
    ' MSIINSTALLPERUSER is only honored when ALLUSERS=2 and requires Windows Installer 5.0+.
    InsProp installer, db, "ALLUSERS", "2"
    InsProp installer, db, "MSIINSTALLPERUSER", "1"
    InsProp installer, db, "InstallScope", "perUser"
    InsProp installer, db, "InstallPrivileges", "limited"

    ' Media table is queried by standard actions; keep a default row even if no files are authored.
    ExecSql installer, db, "INSERT INTO `Media` (`DiskId`,`LastSequence`,`DiskPrompt`,`Cabinet`,`VolumeLabel`,`Source`) VALUES (1,0,NULL,NULL,NULL,NULL)"

    ' Directory tree: TARGETDIR -> LocalAppDataFolder -> INSTALLDIR
    ExecSql installer, db, "INSERT INTO `Directory` (`Directory`,`Directory_Parent`,`DefaultDir`) VALUES ('TARGETDIR',NULL,'SourceDir')"
    ExecSql installer, db, "INSERT INTO `Directory` (`Directory`,`Directory_Parent`,`DefaultDir`) VALUES ('LocalAppDataFolder','TARGETDIR','LocalAppDataFolder')"
    ExecSql installer, db, "INSERT INTO `Directory` (`Directory`,`Directory_Parent`,`DefaultDir`) VALUES ('INSTALLDIR','LocalAppDataFolder','" & SqlQ(productName) & "')"

    ' Feature + component
    ExecSql installer, db, "INSERT INTO `Feature` (`Feature`,`Feature_Parent`,`Title`,`Description`,`Display`,`Level`,`Directory_`,`Attributes`) " & _
                "VALUES ('MainFeature',NULL,'" & SqlQ(productName) & "','Demo feature',0,1,'INSTALLDIR',0)"

    Dim compId As String: compId = "MainComponent"
    Dim compGuid As String: compGuid = NewGuidBraced()
    Dim regId As String: regId = "DemoReg"

    ExecSql installer, db, "INSERT INTO `Component` (`Component`,`ComponentId`,`Directory_`,`Attributes`,`Condition`,`KeyPath`) " & _
                "VALUES ('" & SqlQ(compId) & "','" & SqlQ(compGuid) & "','INSTALLDIR',4,NULL,'" & SqlQ(regId) & "')"

    ExecSql installer, db, "INSERT INTO `FeatureComponents` (`Feature_`,`Component_`) VALUES ('MainFeature','" & SqlQ(compId) & "')"

    ' HKCU\Software\<Manufacturer>\<ProductName>\Installed = 1
    ExecSql installer, db, "INSERT INTO `Registry` (`Registry`,`Root`,`Key`,`Name`,`Value`,`Component_`) VALUES (" & _
                "'" & SqlQ(regId) & "', 1, 'Software\" & SqlQ(manufacturer) & "\" & SqlQ(productName) & "', 'Installed', '1', '" & SqlQ(compId) & "')"

    ' Standard sequences (minimal)
    AddExecAction installer, db, "LaunchConditions", 100
    AddExecAction installer, db, "CostInitialize", 800
    AddExecAction installer, db, "FileCost", 900
    AddExecAction installer, db, "CostFinalize", 1000
    AddExecAction installer, db, "InstallValidate", 1400
    AddExecAction installer, db, "InstallInitialize", 1500
    AddExecAction installer, db, "ProcessComponents", 1600
    AddExecAction installer, db, "WriteRegistryValues", 5000
    AddExecAction installer, db, "RegisterUser", 6000
    AddExecAction installer, db, "RegisterProduct", 6100
    AddExecAction installer, db, "PublishFeatures", 6300
    AddExecAction installer, db, "PublishProduct", 6400
    AddExecAction installer, db, "InstallFinalize", 6600

    AddUiAction installer, db, "LaunchConditions", 100
    AddUiAction installer, db, "CostInitialize", 800
    AddUiAction installer, db, "FileCost", 900
    AddUiAction installer, db, "CostFinalize", 1000
    AddUiAction installer, db, "ExecuteAction", 1300

    ' Type 6 VBScript: one Binary stream with entry points
    Dim binaryName As String: binaryName = "DemoActions.vbs"
    Dim caPreUi As String: caPreUi = "DemoPreUi"
    Dim caUi As String: caUi = "DemoUi"
    Dim caUninstall As String: caUninstall = "DemoUninstall"

    Dim tmpVbs As String
    tmpVbs = CreateTempFilePath(".vbs")
    WriteAsciiTextFile tmpVbs, DemoVbsText()

    InsertBinaryStream installer, db, binaryName, tmpVbs
    DeleteFileQuiet tmpVbs

    ExecSql installer, db, "INSERT INTO `CustomAction` (`Action`,`Type`,`Source`,`Target`) VALUES " & _
                "('" & SqlQ(caPreUi) & "'," & CA_TYPE_VBSCRIPT_BINARY & ",'" & SqlQ(binaryName) & "','PreUiDemo')"
    ExecSql installer, db, "INSERT INTO `CustomAction` (`Action`,`Type`,`Source`,`Target`) VALUES " & _
                "('" & SqlQ(caUi) & "'," & CA_TYPE_VBSCRIPT_BINARY & ",'" & SqlQ(binaryName) & "','UiDemo')"
    ExecSql installer, db, "INSERT INTO `CustomAction` (`Action`,`Type`,`Source`,`Target`) VALUES " & _
                "('" & SqlQ(caUninstall) & "'," & CA_TYPE_VBSCRIPT_BINARY & ",'" & SqlQ(binaryName) & "','UninstallDemo')"

    ' Schedule:
    ' - Pre-UI in UI sequence at 1 (before any authored dialogs)
    ' - UI-stage in UI sequence later (before ExecuteAction)
    ' - Pre-UI also in execute sequence for /qn; script itself suppresses MsgBox when UILevel < 3
    ExecSql installer, db, "INSERT INTO `InstallUISequence` (`Action`,`Condition`,`Sequence`) VALUES ('" & SqlQ(caPreUi) & "','NOT Installed',1)"
    ExecSql installer, db, "INSERT INTO `InstallUISequence` (`Action`,`Condition`,`Sequence`) VALUES ('" & SqlQ(caUi) & "','NOT Installed',1200)"
    ExecSql installer, db, "INSERT INTO `InstallExecuteSequence` (`Action`,`Condition`,`Sequence`) VALUES ('" & SqlQ(caPreUi) & "','NOT Installed AND UILevel < 3',750)"

    ' Uninstall: run near end of execute sequence; avoid firing during major upgrades.
    ExecSql installer, db, "INSERT INTO `InstallExecuteSequence` (`Action`,`Condition`,`Sequence`) VALUES ('" & SqlQ(caUninstall) & "','REMOVE=""ALL"" AND NOT UPGRADINGPRODUCTCODE',6500)"
    ExecSql installer, db, "INSERT INTO `InstallUISequence` (`Action`,`Condition`,`Sequence`) VALUES ('" & SqlQ(caUninstall) & "','REMOVE=""ALL"" AND NOT UPGRADINGPRODUCTCODE',1205)"

    ' Summary Information
    Dim sum As Object: Set sum = db.SummaryInformation(20)
    sum.Property(2) = productName          ' PID_TITLE
    sum.Property(4) = Environ$("USERNAME") ' PID_AUTHOR
    sum.Property(7) = "Intel;1033"        ' PID_TEMPLATE
    sum.Property(9) = packageCode          ' PID_REVNUMBER (PackageCode)
    sum.Property(14) = 200 ' Minimum installer version (2.0)
    sum.Property(15) = 0   ' WordCount flags
    sum.Persist

    db.Commit
End Sub

' Script-only MSI: schedules only InstallInitialize/Finalize and custom actions.
' Avoids RegisterProduct/PublishProduct/etc so the MSI does not end up "installed".
Private Sub CreateScriptOnlyMsiWithType6CAs(ByVal outMsiPath As String)
    Const productName As String = "VBA CA ScriptOnly"
    Const manufacturer As String = "Example Co"
    Const productVersion As String = "1.0.0"

    Dim productCode As String: productCode = NewGuidBraced()
    Dim upgradeCode As String: upgradeCode = NewGuidBraced()
    Dim packageCode As String: packageCode = NewGuidBraced()

    Dim installer As Object: Set installer = CreateObject("WindowsInstaller.Installer")
    Dim db As Object: Set db = installer.OpenDatabase(outMsiPath, msiOpenDatabaseModeCreate)

    ExecSql installer, db, "CREATE TABLE `Property` (`Property` CHAR(72) NOT NULL, `Value` LONGCHAR PRIMARY KEY `Property`)"
    ExecSql installer, db, "CREATE TABLE `InstallExecuteSequence` (`Action` CHAR(72) NOT NULL, `Condition` CHAR(255), `Sequence` SHORT PRIMARY KEY `Action`)"
    ExecSql installer, db, "CREATE TABLE `InstallUISequence` (`Action` CHAR(72) NOT NULL, `Condition` CHAR(255), `Sequence` SHORT PRIMARY KEY `Action`)"
    ExecSql installer, db, "CREATE TABLE `Binary` (`Name` CHAR(72) NOT NULL, `Data` OBJECT NOT NULL PRIMARY KEY `Name`)"
    ExecSql installer, db, "CREATE TABLE `CustomAction` (`Action` CHAR(72) NOT NULL, `Type` SHORT NOT NULL, `Source` CHAR(72), `Target` CHAR(255) PRIMARY KEY `Action`)"

    InsProp installer, db, "ProductName", productName
    InsProp installer, db, "Manufacturer", manufacturer
    InsProp installer, db, "ProductVersion", productVersion
    InsProp installer, db, "ProductLanguage", "1033"
    InsProp installer, db, "ProductCode", productCode
    InsProp installer, db, "UpgradeCode", upgradeCode

    ' Force per-user intent; should avoid UAC unless local policy overrides.
    InsProp installer, db, "ALLUSERS", "2"
    InsProp installer, db, "MSIINSTALLPERUSER", "1"
    InsProp installer, db, "InstallScope", "perUser"
    InsProp installer, db, "InstallPrivileges", "limited"

    Dim binaryName As String: binaryName = "DemoActions.vbs"
    Dim tmpVbs As String
    tmpVbs = CreateTempFilePath(".vbs")
    WriteAsciiTextFile tmpVbs, DemoVbsText()
    InsertBinaryStream installer, db, binaryName, tmpVbs
    DeleteFileQuiet tmpVbs

    Dim caPreUi As String: caPreUi = "DemoPreUi"
    Dim caUi As String: caUi = "DemoUi"
    Dim caExec As String: caExec = "DemoExec"

    ExecSql installer, db, "INSERT INTO `CustomAction` (`Action`,`Type`,`Source`,`Target`) VALUES " & _
                "('" & SqlQ(caPreUi) & "'," & CA_TYPE_VBSCRIPT_BINARY & ",'" & SqlQ(binaryName) & "','PreUiDemo')"
    ExecSql installer, db, "INSERT INTO `CustomAction` (`Action`,`Type`,`Source`,`Target`) VALUES " & _
                "('" & SqlQ(caUi) & "'," & CA_TYPE_VBSCRIPT_BINARY & ",'" & SqlQ(binaryName) & "','UiDemo')"
    ExecSql installer, db, "INSERT INTO `CustomAction` (`Action`,`Type`,`Source`,`Target`) VALUES " & _
                "('" & SqlQ(caExec) & "'," & CA_TYPE_VBSCRIPT_BINARY & ",'" & SqlQ(binaryName) & "','ExecDemo')"

    ' UI sequence: run two UI-stage notifications then proceed to execute.
    ExecSql installer, db, "INSERT INTO `InstallUISequence` (`Action`,`Condition`,`Sequence`) VALUES ('" & SqlQ(caPreUi) & "','1',1)"
    ExecSql installer, db, "INSERT INTO `InstallUISequence` (`Action`,`Condition`,`Sequence`) VALUES ('" & SqlQ(caUi) & "','1',1200)"
    AddUiAction installer, db, "ExecuteAction", 1300

    ' Execute sequence: initialize, run script, finalize.
    AddExecAction installer, db, "InstallInitialize", 1500
    ExecSql installer, db, "INSERT INTO `InstallExecuteSequence` (`Action`,`Condition`,`Sequence`) VALUES ('" & SqlQ(caExec) & "','1',1510)"
    AddExecAction installer, db, "InstallFinalize", 1600

    Dim sum As Object: Set sum = db.SummaryInformation(20)
    sum.Property(2) = productName
    sum.Property(4) = Environ$("USERNAME")
    sum.Property(7) = "Intel;1033"
    sum.Property(9) = packageCode
    sum.Property(14) = 200
    sum.Property(15) = 0
    sum.Persist

    db.Commit
End Sub

Private Function DemoVbsText() As String
    Dim s As String

    s = "Option Explicit" & vbCrLf
    s = s & vbCrLf
    s = s & "Function PreUiDemo()" & vbCrLf
    s = s & "  Call DemoShow(""Pre-UI"", ""This runs very early in InstallUISequence."" )" & vbCrLf
    s = s & "  PreUiDemo = 1" & vbCrLf
    s = s & "End Function" & vbCrLf
    s = s & vbCrLf
    s = s & "Function UiDemo()" & vbCrLf
    s = s & "  Call DemoShow(""UI"", ""This runs later in InstallUISequence."" )" & vbCrLf
    s = s & "  UiDemo = 1" & vbCrLf
    s = s & "End Function" & vbCrLf
    s = s & vbCrLf
    s = s & "Function UninstallDemo()" & vbCrLf
    s = s & "  Call DemoShow(""UNINSTALL"", ""This runs during uninstall."" )" & vbCrLf
    s = s & "  UninstallDemo = 1" & vbCrLf
    s = s & "End Function" & vbCrLf
    s = s & vbCrLf
    s = s & "Function ExecDemo()" & vbCrLf
    s = s & "  Call DemoShow(""EXEC"", ""This runs in InstallExecuteSequence."" )" & vbCrLf
    s = s & "  ExecDemo = 1" & vbCrLf
    s = s & "End Function" & vbCrLf
    s = s & vbCrLf
    s = s & "Sub DemoShow(stage, detail)" & vbCrLf
    s = s & "  On Error Resume Next" & vbCrLf
    s = s & "  Dim ui: ui = CLng(Session.Property(""UILevel""))" & vbCrLf
    s = s & "  Session.Log ""[DemoType6] "" & stage & "" running; UILevel="" & ui" & vbCrLf
    s = s & "  If ui >= 3 Then" & vbCrLf
    s = s & "    MsgBox stage & "": "" & detail & vbCrLf & ""UILevel="" & ui, 64, ""MSI Type 6 Demo""" & vbCrLf
    s = s & "  End If" & vbCrLf
    s = s & "End Sub" & vbCrLf

    DemoVbsText = s
End Function

Private Sub ExecSql(ByVal installer As Object, ByVal db As Object, ByVal sql As String)
    Dim view As Object
    On Error GoTo EH
    Set view = db.OpenView(sql)
    view.Execute
    view.Close
    Exit Sub
EH:
    Debug.Print "---- ExecSql failed ----"
    Debug.Print sql
    On Error Resume Next
    Debug.Print installer.LastErrorRecord.FormatText()
    On Error GoTo 0
    Err.Raise Err.Number, "ExecSql", Err.Description
End Sub
Private Sub InsProp(ByVal installer As Object, ByVal db As Object, ByVal k As String, ByVal v As String)
    ExecSql installer, db, "INSERT INTO `Property` (`Property`,`Value`) VALUES ('" & SqlQ(k) & "','" & SqlQ(v) & "')"
End Sub

Private Sub AddExecAction(ByVal installer As Object, ByVal db As Object, ByVal action As String, ByVal seq As Integer)
    ExecSql installer, db, "INSERT INTO `InstallExecuteSequence` (`Action`,`Condition`,`Sequence`) VALUES ('" & SqlQ(action) & "',NULL," & seq & ")"
End Sub

Private Sub AddUiAction(ByVal installer As Object, ByVal db As Object, ByVal action As String, ByVal seq As Integer)
    ExecSql installer, db, "INSERT INTO `InstallUISequence` (`Action`,`Condition`,`Sequence`) VALUES ('" & SqlQ(action) & "',NULL," & seq & ")"
End Sub

Private Sub InsertBinaryStream(ByVal installer As Object, ByVal db As Object, ByVal name As String, ByVal filePath As String)
    Dim view As Object, rec As Object
    Set view = db.OpenView("INSERT INTO `Binary` (`Name`,`Data`) VALUES (?, ?)")
    Set rec = installer.CreateRecord(2)
    rec.StringData(1) = name
    rec.SetStream 2, filePath
    view.Execute rec
    view.Close
End Sub

Private Function NewGuidBraced() As String
    Dim g As GUID
    Dim buf As String
    Dim n As Long
    Dim nulPos As Long
    If CoCreateGuid(g) <> 0 Then Err.Raise vbObjectError + 1, "GUID", "CoCreateGuid failed"
    buf = String$(64, vbNullChar)                ' wide-char buffer
    n = StringFromGUID2(g, StrPtr(buf), Len(buf)) ' chars written incl terminating NULL
    If n = 0 Then Err.Raise vbObjectError + 2, "GUID", "StringFromGUID2 failed"
    nulPos = InStr(1, buf, vbNullChar)
    If nulPos > 0 Then
        NewGuidBraced = Left$(buf, nulPos - 1)
    Else
        NewGuidBraced = Left$(buf, n - 1)
    End If
End Function
Public Sub TestGuid()
    Dim i As Long
    For i = 1 To 5
        Debug.Print NewGuidBraced()
    Next
End Sub
Private Function SqlQ(ByVal s As String) As String
    SqlQ = Replace(s, "'", "''")
End Function

Private Function GetOutputDir() As String
    If Len(CFG_OUTPUT_DIR) <> 0 Then
        GetOutputDir = CFG_OUTPUT_DIR
    Else
        GetOutputDir = CurDir$
    End If
End Function

Private Function GetTempDir() As String
    If Len(CFG_TEMP_DIR) <> 0 Then
        GetTempDir = CFG_TEMP_DIR
    Else
        GetTempDir = Environ$("TEMP")
    End If
End Function

Private Function EnsureTrailingBackslash(ByVal dirPath As String) As String
    If Len(dirPath) = 0 Then
        EnsureTrailingBackslash = ""
    ElseIf Right$(dirPath, 1) = "\" Then
        EnsureTrailingBackslash = dirPath
    Else
        EnsureTrailingBackslash = dirPath & "\"
    End If
End Function

Private Function BuildOutputPath(ByVal fileName As String) As String
    BuildOutputPath = EnsureTrailingBackslash(GetOutputDir()) & fileName
End Function

Private Function BuildTempPath(ByVal fileName As String) As String
    BuildTempPath = EnsureTrailingBackslash(GetTempDir()) & fileName
End Function

Private Function CreateTempFilePath(ByVal extensionWithDot As String) As String
    ' Creates a unique path under the configured temp directory.
    Dim g As String
    g = Replace$(Replace$(Replace$(NewGuidBraced(), "{", ""), "}", ""), "-", "")
    CreateTempFilePath = BuildTempPath("msi_" & g & extensionWithDot)
End Function

Private Sub WriteAsciiTextFile(ByVal filePath As String, ByVal text As String)
    Dim fso As Object, ts As Object
    Set fso = CreateObject("Scripting.FileSystemObject")
    Set ts = fso.CreateTextFile(filePath, True, False) ' ASCII/ANSI
    ts.Write text
    ts.Close
End Sub

Private Sub DeleteFileQuiet(ByVal filePath As String)
    On Error Resume Next
    Dim fso As Object
    Set fso = CreateObject("Scripting.FileSystemObject")
    If fso.FileExists(filePath) Then fso.DeleteFile filePath, True
    On Error GoTo 0
End Sub
