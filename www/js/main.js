
// Use window.isPhone to show global var or just use without "window." ...
var isPhone      = false;
var isRegistered = true;

const   MAIN_LOOP_COUNTER_MAX   = 20;

var szImgG32                = "<img src='img/G32-Lg.png' width='160' alt='' class='image_product'> <div id='go_sn_id' class='text_producttitle'>" + guiSerialNumber + "</div>";
var szImgG31                = "<img src='img/G31-Lg.png' width='160' alt='' class='image_product'> <div id='go_sn_id' class='text_producttitle'>" + guiSerialNumber + "</div>";
// var szSbIfIconOn            = "<img src='img/bluetooth_on.png' />";
// var szSbIfIconOff           = "<img src='img/bluetooth_off.png' />";
// var szSbIfMainOn            = "<img src='img/bt_main_on.png' />";
// var szSbIfMainOff           = "<img src='img/bt_main_off.png' />";
var iOSPlatform             = "iOS";
var androidPlatform         = "Android";


//var szBtIconOn              = "<img src='img/bluetooth_on.png' />";
//var szBtIconOff             = "<img src='img/bluetooth_off.png' />";
// var szRegIconReg            = "<img src='img/reg_yes.png' />";
// var szRegIconNotReg         = "<img src='img/reg_no.png' />";                       // With bar
// var szMyStatusLine          = "<p id='status_line_id' class='status_line'></p>";
// var szMyRssiLine            = "<p id='rssi_line_id'   class='rssi_line'></p>";
var myModel                 = "MN8";
var mySn                    = "12345678";
var myPlatformUrl           = "https://nextivity-sandbox-connect.axeda.com:443/ammp/";
var myOperatorCode          = "0000";
var myLat                   = 32.987838;             // Nextivity lat
var myLong                  = -117.074195;           // Nextivity long
var currentView             = "main";
var bDisplayBackgroundRing  = false;
var bSentCloud              = false;
var bUniiUp                 = true;
var bNaking                 = false;
var isNetworkConnected      = null;
var bGotUserInfoRspFromCloud    = false;
var msgTimer                = null; 
var szVersion               = "00.02.14";

//  2/1/19:  00.02.10:   Added thunk capability for Haywards.
//  2/5/19:  00.02.11:   Added babbling detection.
//  2/11/19: 00.02.12:   Added RSSI printing and if same RSSI value for 2 seconds then show no BT.
//  3/13/19: 00.02.13:   Disabled the BT scan blocking...Removed, did not work.   Left version at 13.
//  3/14/19: 00.02.14:   Added insomnia.keepAwake() to kee the phone focused.


var szSuccess               = "";
var retryObject             = null;
var retryCount              = 0;
var bSpinner                = false;
var szNoStatus              = "No status response from unit so ICD version not known...kill app and retry";
var bCnxToCu                = true;             // Set to true if connected locally to CU after reading local BoardConfig.
var bCnxToOneBoxNu          = false;            // Set to true if connected to a 1-Box NU, all UART redirects are disabled.

var bPhoneInBackground      = false;    // Set to true if phone is in background.
var bFollowMyPhoneFlag      = false;    // Set to true when phone in Follow My Phone mode.
var phoneFollowTag          = null;

// Determine which messages get sent to the console.  1 normal, 10 verbose.
// Level  1: Flow and errors.
// Level  2: Raw bluetooth Tx data
// Level  3: Raw bluetooth Rx Data partial msgs
// Level  4: Timing loops
// Level 10: Bluetooth processing.
// Level 99: Error, print in red.
var PrintLogLevel = 3;


// PrintLog............................................................................................
function PrintLog(level, txt)
{
    var d       = new Date();
    var myMs    = d.getMilliseconds();
    
    
    if( myMs < 10 )
    {
        myMs = "00" + myMs;
    }
    else if( myMs < 100 )
    {
        myMs = "0" + myMs;
    }
    
    
    if( level == 99 )
    {
//        console.log("**** Error: (" + d.getSeconds() + "." + d.getMilliseconds() + ") " + txt);
        var logText = "(" + d.getMinutes() + ":" + d.getSeconds() + "." + myMs + ") **** Error: " + txt;
        console.log( logText );
        WriteLogFile( logText );
        
//jdo        console.error(txt);            // console.error does not work on phonegap
    }
    else if( level <= PrintLogLevel )
    { 
        var logText = "(" + d.getMinutes() + ":" + d.getSeconds() + "." + myMs + ") " + txt;
        console.log( logText );
        WriteLogFile( logText );
    }
    
}


// SpinnerStart........................................................................................
// Had to add a plugin for Spinners since IOS does not support navigator.notification.activityStart()
function SpinnerStart(title, msg )
{
    SpinnerStop();
    
    // Note: spinner dialog is cancelable by default on Android and iOS. On WP8, it's fixed by default
    // so make fixed on all platforms.
    // Title is only allowed on Android so never show the title.
    window.plugins.spinnerDialog.show(null, msg, true);
    bSpinner = true;
    
    // Save to log file...
    PrintLog(1, "Spinner: " + msg );
    
}

// SpinnerStop........................................................................................
function SpinnerStop()
{
    if( bSpinner )
    {
        window.plugins.spinnerDialog.hide();
        bSpinner = false;
    }
}


// UpdateStatusLine....................................................................................
function UpdateStatusLine(statusText)
{
//    document.getElementById("status_line_id").innerHTML = statusText;
}

// UpdateRssiLine....................................................................................
function UpdateRssiLine(rssiVal)
{
    document.getElementById("rssi_line_id").innerHTML = "RSSI: " + rssiVal;
}

// HandleButtonDown............................................................................................
function HandleButtonDown()
{
    // No transparency when pressed...
    $(this).css("opacity","1.0");
}

// HandleButtonUp............................................................................................
function HandleButtonUp()
{
    $(this).css("opacity","0.75");
    $(this).css("outline", "none" );       // Used to remove orange box for android 4+
}


// U8ToHexText............................................................................................
function U8ToHexText(u8)
{
    if( u8 < 0x10 )
    {
        return( "0" + u8.toString(16) );     // Add a leading 0....
    }
    else
    {
        return( u8.toString(16) );     
    }
}


// UpdateRegButton....................................................................................
function UpdateRegButton(reg)
{
    if(reg == 1)
    {
        // Already registered so remove button.
        document.getElementById("reg_button_id").innerHTML = "";
    }
    else
    {
        // Not registered so add button...
        document.getElementById("reg_button_id").innerHTML = "<img src='img/button_Register.png' />";
    }
}









function showAlert(message, title) 
{
  if(window.isPhone) 
  {
    navigator.notification.alert(message, null, title, 'ok');
  } 
  else 
  {
    alert(title ? (title + ": " + message) : message);
  }
}




function successAcquirePowerManagement()
{
    PrintLog(1, "Power management acquire success.  Autolock disabled so phone does not go to sleep." );
}

function failAcquirePowerManagement()
{
    PrintLog(1, "Power management acquire fail.  Autolock not disabled so phone may go to sleep." );
}


// ..................................................................................
var app = {
     
    // deviceready Event Handler
    //
    // PhoneGap is now loaded and it is now safe to make calls using PhoneGap
    //
    onDeviceReady: function() 
    {
    
        if( window.device.platform != iOSPlatform )
        {
            // IOS did not like opening the file system this early, no error just stalled.
//            OpenFileSystem();
    
            PrintLog(10,  "device ready:  Running on phone version: " + window.device.version + " parseFloat:" + parseFloat(window.device.version) );
        }
    
        
        isNxtyStatusCurrent = false;
        isNxtySnCurrent     = false;
        
        
        

        // Register the event listener if the back button is pressed...
        document.addEventListener("backbutton", app.onBackKeyDown, false);
        document.addEventListener("pause", HandlePhoneBackground, false);
        
        
        
        app.renderHomeView();
        
        
        if( window.device.platform == iOSPlatform )
        {
            if (parseFloat(window.device.version) >= 7.0) 
            {
                StatusBar.hide();
            }
        } 
        
  
        StartMainLoop();
        
//        WaitForFileSystemThenStartSouthboundIf();
        window.plugins.insomnia.keepAwake( successAcquirePowerManagement, failAcquirePowerManagement );            //
        
    },   
       
       

    // Handle the back button
    //
    onBackKeyDown: function() 
    {
        UpdateStatusLine( "Back pressed" );
             
        if( currentView == "main" )
        {
            // Kill the app...
            DisconnectBluetoothDevice();
            navigator.app.exitApp();
        }
        else
        {
            showAlert("Back to where?", "Back...");
        }
        
    },




    // Handle the Register key
    // Global Flags: 0xF0000038 = 0xF1AC0100
    handleRegKey: function()
    {
        if( retryObject == null )
        {    
            PrintLog(1, "");
            PrintLog(1, "Register key pressed--------------------------------------");
         }
         else
         {
            PrintLog(1, "Register key retry--------------------------------------");
         }
         
         if( nxtyRxStatusIcd == null )
        {
            PrintLog(1, szNoStatus );
            showAlert(szNoStatus, "No Status Response");
            return;
         }
         
         
         if( isSouthBoundIfCnx )
         {
            if( nxtyRxStatusIcd <= 0x07 )
            {
                var u8Buff  = new Uint8Array(20);
                u8Buff[0] = 0x81;                               // Redirect to NU on entry and exit...   
                u8Buff[1] = (NXTY_PCCTRL_GLOBALFLAGS >> 24);    // Note that javascript converts var to INT32 for shift operations.
                u8Buff[2] = (NXTY_PCCTRL_GLOBALFLAGS >> 16);
                u8Buff[3] = (NXTY_PCCTRL_GLOBALFLAGS >> 8);
                u8Buff[4] = NXTY_PCCTRL_GLOBALFLAGS;
                u8Buff[5] = 0xF1;                    
                u8Buff[6] = 0xAC;
                u8Buff[7] = 0x01;
                u8Buff[8] = 0x00;
                
                nxty.SendNxtyMsg(NXTY_CONTROL_WRITE_REQ, u8Buff, 9);
            }
            else
            {
                var i             = 0;
                var u8TempTxBuff  = new Uint8Array(50);
            
                PrintLog(1,  "Super Msg Send: Register" );
            
                // Redirect the UART........................................
                u8TempTxBuff[i++] = NXTY_WRITE_ADDRESS_REQ;
                u8TempTxBuff[i++] = (NXTY_PCCTRL_UART_REDIRECT >> 24);  
                u8TempTxBuff[i++] = (NXTY_PCCTRL_UART_REDIRECT >> 16);
                u8TempTxBuff[i++] = (NXTY_PCCTRL_UART_REDIRECT >> 8);
                u8TempTxBuff[i++] = NXTY_PCCTRL_UART_REDIRECT;
                u8TempTxBuff[i++] = 0x00;                               
                u8TempTxBuff[i++] = 0x00;
                u8TempTxBuff[i++] = 0x00;
                u8TempTxBuff[i++] = 0x01;                                   // Set to 1 to redirect to remote unit
            
            
                // Unregister.................................................                
                u8TempTxBuff[i++] = NXTY_WRITE_ADDRESS_REQ;
                u8TempTxBuff[i++] = (NXTY_PCCTRL_GLOBALFLAGS >> 24);  
                u8TempTxBuff[i++] = (NXTY_PCCTRL_GLOBALFLAGS >> 16);
                u8TempTxBuff[i++] = (NXTY_PCCTRL_GLOBALFLAGS >> 8);
                u8TempTxBuff[i++] = NXTY_PCCTRL_GLOBALFLAGS;
                u8TempTxBuff[i++] = 0xF1;              
                u8TempTxBuff[i++] = 0xAC;
                u8TempTxBuff[i++] = 0x01;
                u8TempTxBuff[i++] = 0x00;
                
                // Redirect the UART Local........................................
                u8TempTxBuff[i++] = NXTY_WRITE_ADDRESS_REQ;
                u8TempTxBuff[i++] = (NXTY_PCCTRL_UART_REDIRECT >> 24);  
                u8TempTxBuff[i++] = (NXTY_PCCTRL_UART_REDIRECT >> 16);
                u8TempTxBuff[i++] = (NXTY_PCCTRL_UART_REDIRECT >> 8);
                u8TempTxBuff[i++] = NXTY_PCCTRL_UART_REDIRECT;
                u8TempTxBuff[i++] = 0x00;                               
                u8TempTxBuff[i++] = 0x00;
                u8TempTxBuff[i++] = 0x00;
                u8TempTxBuff[i++] = 0x00;                                   // Set to 0 to go back local
            
                
                nxtyCurrentReq = NXTY_SUPER_MSG_SET_NU_PARAM;
                nxty.SendNxtyMsg(NXTY_SUPER_MSG_REQ, u8TempTxBuff, i);
            }
            
            // Start the spinner..
            bUniiUp = true;
            SpinnerStart( "", "Register command sent to NU." );
            szSuccess = "Unit should now be registered...";
             msgTimer = setTimeout(app.handleRespnose, 6000);
            retryObject = app.handleRegKey;
             
         
         }
         else
         {
            SpinnerStop();
            showAlert("Register not allowed...", "Bluetooth not connected.");
         }
    },

    
    // Handle the Un Register key
    // Global Flags: 0xF0000038 = 0xF1AC0001    
    handleUnRegKey: function()
    {
        if( retryObject == null )
        {   
            PrintLog(1, "");
            PrintLog(1, "Un Register key pressed--------------------------------------");
        }
        else
        {
            PrintLog(1, "Un Register key retry--------------------------------------");
        }

        if( nxtyRxStatusIcd == null )
        {
            PrintLog(1, szNoStatus );
            showAlert(szNoStatus, "No Status Response");
            return;
        }
        
        if( isSouthBoundIfCnx )
        {
            if( nxtyRxStatusIcd <= 0x07 )
            {
                var u8Buff  = new Uint8Array(20);
                u8Buff[0] = 0x81;                               // Redirect to NU on entry and exit...   
                u8Buff[1] = (NXTY_PCCTRL_GLOBALFLAGS >> 24);
                u8Buff[2] = (NXTY_PCCTRL_GLOBALFLAGS >> 16);
                u8Buff[3] = (NXTY_PCCTRL_GLOBALFLAGS >> 8);
                u8Buff[4] = NXTY_PCCTRL_GLOBALFLAGS;
                u8Buff[5] = 0xF1;                   
                u8Buff[6] = 0xAC;
                u8Buff[7] = 0x00;
                u8Buff[8] = 0x01;
                
                nxty.SendNxtyMsg(NXTY_CONTROL_WRITE_REQ, u8Buff, 9);
            }
            else
            {
                var i             = 0;
                var u8TempTxBuff  = new Uint8Array(50);
            
                PrintLog(1,  "Super Msg Send: Un Register" );
            
                // Redirect the UART........................................
                u8TempTxBuff[i++] = NXTY_WRITE_ADDRESS_REQ;
                u8TempTxBuff[i++] = (NXTY_PCCTRL_UART_REDIRECT >> 24);  
                u8TempTxBuff[i++] = (NXTY_PCCTRL_UART_REDIRECT >> 16);
                u8TempTxBuff[i++] = (NXTY_PCCTRL_UART_REDIRECT >> 8);
                u8TempTxBuff[i++] = NXTY_PCCTRL_UART_REDIRECT;
                u8TempTxBuff[i++] = 0x00;                               
                u8TempTxBuff[i++] = 0x00;
                u8TempTxBuff[i++] = 0x00;
                u8TempTxBuff[i++] = 0x01;                                   // Set to 1 to redirect to remote unit
            
            
                // Unregister.................................................                
                u8TempTxBuff[i++] = NXTY_WRITE_ADDRESS_REQ;
                u8TempTxBuff[i++] = (NXTY_PCCTRL_GLOBALFLAGS >> 24);  
                u8TempTxBuff[i++] = (NXTY_PCCTRL_GLOBALFLAGS >> 16);
                u8TempTxBuff[i++] = (NXTY_PCCTRL_GLOBALFLAGS >> 8);
                u8TempTxBuff[i++] = NXTY_PCCTRL_GLOBALFLAGS;
                u8TempTxBuff[i++] = 0xF1;              
                u8TempTxBuff[i++] = 0xAC;
                u8TempTxBuff[i++] = 0x00;
                u8TempTxBuff[i++] = 0x01;
                
                // Redirect the UART Local........................................
                u8TempTxBuff[i++] = NXTY_WRITE_ADDRESS_REQ;
                u8TempTxBuff[i++] = (NXTY_PCCTRL_UART_REDIRECT >> 24);  
                u8TempTxBuff[i++] = (NXTY_PCCTRL_UART_REDIRECT >> 16);
                u8TempTxBuff[i++] = (NXTY_PCCTRL_UART_REDIRECT >> 8);
                u8TempTxBuff[i++] = NXTY_PCCTRL_UART_REDIRECT;
                u8TempTxBuff[i++] = 0x00;                               
                u8TempTxBuff[i++] = 0x00;
                u8TempTxBuff[i++] = 0x00;
                u8TempTxBuff[i++] = 0x00;                                   // Set to 0 to go back local
            
                
                nxtyCurrentReq = NXTY_SUPER_MSG_SET_NU_PARAM;
                nxty.SendNxtyMsg(NXTY_SUPER_MSG_REQ, u8TempTxBuff, i);
            }
            
            // Start the spinner..
            bUniiUp = true;
            SpinnerStart( "", "Unregister command sent to NU." );
            szSuccess = "Unit should now be unregistered...";
            msgTimer = setTimeout(app.handleRespnose, 6000);
            retryObject = app.handleUnRegKey;
        
        }
        else
        {
            SpinnerStop();
            showAlert("Un-Register not allowed...", "Bluetooth not connected.");
        }
    },




    // Handle the Quick Lock key
    // FUNCTION reg:  0xF0000000 = 0x00010000
    handleQLockKey: function()
    {
        if( retryObject == null )
        {   
            PrintLog(1, "");
            PrintLog(1, "Quick Location Lock key pressed--------------------------------------");
        }
        else
        {
            PrintLog(1, "Quick Location Lock key retry--------------------------------------");
        }

        if( nxtyRxStatusIcd == null )
        {
            PrintLog(1, szNoStatus );
            showAlert(szNoStatus, "No Status Response");
            return;
        }
        
        if( isSouthBoundIfCnx )
        {
            if( nxtyRxStatusIcd <= 0x07 )
            {
                // Write 0x00010000  to PcCtrl, Function
                var u8Buff  = new Uint8Array(20);
                u8Buff[0] = 0x81;                               // Redirect to NU on entry and exit...   
                u8Buff[1] = (NXTY_PCCTRL_FUNCTION >> 24);    
                u8Buff[2] = (NXTY_PCCTRL_FUNCTION >> 16);
                u8Buff[3] = (NXTY_PCCTRL_FUNCTION >> 8);
                u8Buff[4] = NXTY_PCCTRL_FUNCTION;
                u8Buff[5] = 0x00;                    
                u8Buff[6] = 0x01;
                u8Buff[7] = 0x00;
                u8Buff[8] = 0x00;
                
                nxty.SendNxtyMsg(NXTY_CONTROL_WRITE_REQ, u8Buff, 9);
            }
            else
            {
                var i             = 0;
                var u8TempTxBuff  = new Uint8Array(50);
            
                PrintLog(1,  "Super Msg Send: Set Quick Location Lock" );
            
                // Redirect the UART........................................
                u8TempTxBuff[i++] = NXTY_WRITE_ADDRESS_REQ;
                u8TempTxBuff[i++] = (NXTY_PCCTRL_UART_REDIRECT >> 24);  
                u8TempTxBuff[i++] = (NXTY_PCCTRL_UART_REDIRECT >> 16);
                u8TempTxBuff[i++] = (NXTY_PCCTRL_UART_REDIRECT >> 8);
                u8TempTxBuff[i++] = NXTY_PCCTRL_UART_REDIRECT;
                u8TempTxBuff[i++] = 0x00;                               
                u8TempTxBuff[i++] = 0x00;
                u8TempTxBuff[i++] = 0x00;
                u8TempTxBuff[i++] = 0x01;                                   // Set to 1 to redirect to remote unit
            
            
                // Clear Location Lock.................................................                
                u8TempTxBuff[i++] = NXTY_WRITE_ADDRESS_REQ;
                u8TempTxBuff[i++] = (NXTY_PCCTRL_FUNCTION >> 24);  
                u8TempTxBuff[i++] = (NXTY_PCCTRL_FUNCTION >> 16);
                u8TempTxBuff[i++] = (NXTY_PCCTRL_FUNCTION >> 8);
                u8TempTxBuff[i++] = NXTY_PCCTRL_FUNCTION;
                u8TempTxBuff[i++] = 0x00;              
                u8TempTxBuff[i++] = 0x01;
                u8TempTxBuff[i++] = 0x00;
                u8TempTxBuff[i++] = 0x00;
                
                // Redirect the UART Local........................................
                u8TempTxBuff[i++] = NXTY_WRITE_ADDRESS_REQ;
                u8TempTxBuff[i++] = (NXTY_PCCTRL_UART_REDIRECT >> 24);  
                u8TempTxBuff[i++] = (NXTY_PCCTRL_UART_REDIRECT >> 16);
                u8TempTxBuff[i++] = (NXTY_PCCTRL_UART_REDIRECT >> 8);
                u8TempTxBuff[i++] = NXTY_PCCTRL_UART_REDIRECT;
                u8TempTxBuff[i++] = 0x00;                               
                u8TempTxBuff[i++] = 0x00;
                u8TempTxBuff[i++] = 0x00;
                u8TempTxBuff[i++] = 0x00;                                   // Set to 0 to go back local
            
                
                nxtyCurrentReq = NXTY_SUPER_MSG_SET_NU_PARAM;
                nxty.SendNxtyMsg(NXTY_SUPER_MSG_REQ, u8TempTxBuff, i);
            }
            
            // Start the spinner..
            bUniiUp = true;
            SpinnerStart( "", "Quick Location Lock command sent to NU." );
            szSuccess = "Quick Location Lock should now be set...";
            msgTimer = setTimeout(app.handleRespnose, 6000);
            retryObject = app.handleQLockKey;
        
        }
        else
        {
            SpinnerStop();
            showAlert("Quick Location Lock not allowed...", "Bluetooth not connected.");
        }
    },


    // Handle the Clear Lock key
    // CellIdTime: 0xF000002C = 0xDABADABA
    handleCLockKey: function()
    {
        if( retryObject == null )
        {   
            PrintLog(1, "");
            PrintLog(1, "Clear Location Lock key pressed--------------------------------------");
        }
        else
        {
            PrintLog(1, "Clear Location Lock key retry--------------------------------------");
        }

        if( nxtyRxStatusIcd == null )
        {
            PrintLog(1, szNoStatus );
            showAlert(szNoStatus, "No Status Response");
            return;
        }
        
        if( isSouthBoundIfCnx )
        {
            if( nxtyRxStatusIcd <= 0x07 )
            {
                // Write 0xDABADABA  to PcCtrl, CellIdTime
                var u8Buff  = new Uint8Array(20);
                u8Buff[0] = 0x81;                               // Redirect to NU on entry and exit...   
                u8Buff[1] = (NXTY_PCCTRL_CELLIDTIME >> 24);    // Note that javascript converts var to INT32 for shift operations.
                u8Buff[2] = (NXTY_PCCTRL_CELLIDTIME >> 16);
                u8Buff[3] = (NXTY_PCCTRL_CELLIDTIME >> 8);
                u8Buff[4] = NXTY_PCCTRL_CELLIDTIME;
                u8Buff[5] = 0xDA;                    // Note that javascript converts var to INT32 for shift operations.
                u8Buff[6] = 0xBA;
                u8Buff[7] = 0xDA;
                u8Buff[8] = 0xBA;
                
                nxty.SendNxtyMsg(NXTY_CONTROL_WRITE_REQ, u8Buff, 9);
            }
            else
            {
                var i             = 0;
                var u8TempTxBuff  = new Uint8Array(50);
            
                PrintLog(1,  "Super Msg Send: Clear Location Lock" );
            
                // Redirect the UART........................................
                u8TempTxBuff[i++] = NXTY_WRITE_ADDRESS_REQ;
                u8TempTxBuff[i++] = (NXTY_PCCTRL_UART_REDIRECT >> 24);  
                u8TempTxBuff[i++] = (NXTY_PCCTRL_UART_REDIRECT >> 16);
                u8TempTxBuff[i++] = (NXTY_PCCTRL_UART_REDIRECT >> 8);
                u8TempTxBuff[i++] = NXTY_PCCTRL_UART_REDIRECT;
                u8TempTxBuff[i++] = 0x00;                               
                u8TempTxBuff[i++] = 0x00;
                u8TempTxBuff[i++] = 0x00;
                u8TempTxBuff[i++] = 0x01;                                   // Set to 1 to redirect to remote unit
            
            
                // Clear Location Lock.................................................                
                u8TempTxBuff[i++] = NXTY_WRITE_ADDRESS_REQ;
                u8TempTxBuff[i++] = (NXTY_PCCTRL_CELLIDTIME >> 24);  
                u8TempTxBuff[i++] = (NXTY_PCCTRL_CELLIDTIME >> 16);
                u8TempTxBuff[i++] = (NXTY_PCCTRL_CELLIDTIME >> 8);
                u8TempTxBuff[i++] = NXTY_PCCTRL_CELLIDTIME;
                u8TempTxBuff[i++] = 0xDA;              
                u8TempTxBuff[i++] = 0xBA;
                u8TempTxBuff[i++] = 0xDA;
                u8TempTxBuff[i++] = 0xBA;
                
                // Redirect the UART Local........................................
                u8TempTxBuff[i++] = NXTY_WRITE_ADDRESS_REQ;
                u8TempTxBuff[i++] = (NXTY_PCCTRL_UART_REDIRECT >> 24);  
                u8TempTxBuff[i++] = (NXTY_PCCTRL_UART_REDIRECT >> 16);
                u8TempTxBuff[i++] = (NXTY_PCCTRL_UART_REDIRECT >> 8);
                u8TempTxBuff[i++] = NXTY_PCCTRL_UART_REDIRECT;
                u8TempTxBuff[i++] = 0x00;                               
                u8TempTxBuff[i++] = 0x00;
                u8TempTxBuff[i++] = 0x00;
                u8TempTxBuff[i++] = 0x00;                                   // Set to 0 to go back local
            
                
                nxtyCurrentReq = NXTY_SUPER_MSG_SET_NU_PARAM;
                nxty.SendNxtyMsg(NXTY_SUPER_MSG_REQ, u8TempTxBuff, i);
            }
            
            // Start the spinner..
            bUniiUp = true;
            SpinnerStart( "", "Clear Location Lock command sent to NU." );
            szSuccess = "Location Lock should now be cleared...";
            msgTimer = setTimeout(app.handleRespnose, 6000);
            retryObject = app.handleCLockKey;
        
        }
        else
        {
            SpinnerStop();
            showAlert("Clear Location Lock not allowed...", "Bluetooth not connected.");
        }
    },



    // Handle the Bypass CAC key
    // CacFrameTimer: 0xF0000090 = 0x00000001
    handleBypassCacKey: function()
    {
        if( retryObject == null )
        {   
            PrintLog(1, "");
            PrintLog(1, "Bypass CAC key pressed--------------------------------------");
        }
        else
        {
            PrintLog(1, "Bypass CAC key retry--------------------------------------");
        }

        if( nxtyRxStatusIcd == null )
        {
            PrintLog(1, szNoStatus );
            showAlert(szNoStatus, "No Status Response");
            return;
        }
        
        if( isSouthBoundIfCnx )
        {
            if( nxtyRxStatusIcd <= 0x07 )
            {
                var u8Buff  = new Uint8Array(20);
                u8Buff[0] = 0x81;                               // Redirect to NU on entry and exit...   
                u8Buff[1] = (NXTY_PCCTRL_CAC_FRAME_TIMER >> 24);    // Note that javascript converts var to INT32 for shift operations.
                u8Buff[2] = (NXTY_PCCTRL_CAC_FRAME_TIMER >> 16);
                u8Buff[3] = (NXTY_PCCTRL_CAC_FRAME_TIMER >> 8);
                u8Buff[4] = NXTY_PCCTRL_CAC_FRAME_TIMER;
                u8Buff[5] = 0x00;                    // Note that javascript converts var to INT32 for shift operations.
                u8Buff[6] = 0x00;
                u8Buff[7] = 0x00;
                u8Buff[8] = 0x01;
                
                nxty.SendNxtyMsg(NXTY_CONTROL_WRITE_REQ, u8Buff, 9);
            }
            else
            {
                var i             = 0;
                var u8TempTxBuff  = new Uint8Array(50);
            
                PrintLog(1,  "Super Msg Send: Bypass CAC to NU" );
            
                // Redirect the UART........................................
                u8TempTxBuff[i++] = NXTY_WRITE_ADDRESS_REQ;
                u8TempTxBuff[i++] = (NXTY_PCCTRL_UART_REDIRECT >> 24);  
                u8TempTxBuff[i++] = (NXTY_PCCTRL_UART_REDIRECT >> 16);
                u8TempTxBuff[i++] = (NXTY_PCCTRL_UART_REDIRECT >> 8);
                u8TempTxBuff[i++] = NXTY_PCCTRL_UART_REDIRECT;
                u8TempTxBuff[i++] = 0x00;                               
                u8TempTxBuff[i++] = 0x00;
                u8TempTxBuff[i++] = 0x00;
                u8TempTxBuff[i++] = 0x01;                                   // Set to 1 to redirect to remote unit
            
            
                // Clear Location Lock.................................................                
                u8TempTxBuff[i++] = NXTY_WRITE_ADDRESS_REQ;
                u8TempTxBuff[i++] = (NXTY_PCCTRL_CAC_FRAME_TIMER >> 24);  
                u8TempTxBuff[i++] = (NXTY_PCCTRL_CAC_FRAME_TIMER >> 16);
                u8TempTxBuff[i++] = (NXTY_PCCTRL_CAC_FRAME_TIMER >> 8);
                u8TempTxBuff[i++] = NXTY_PCCTRL_CAC_FRAME_TIMER;
                u8TempTxBuff[i++] = 0x00;              
                u8TempTxBuff[i++] = 0x00;
                u8TempTxBuff[i++] = 0x00;
                u8TempTxBuff[i++] = 0x01;
                
                // Redirect the UART Local........................................
                u8TempTxBuff[i++] = NXTY_WRITE_ADDRESS_REQ;
                u8TempTxBuff[i++] = (NXTY_PCCTRL_UART_REDIRECT >> 24);  
                u8TempTxBuff[i++] = (NXTY_PCCTRL_UART_REDIRECT >> 16);
                u8TempTxBuff[i++] = (NXTY_PCCTRL_UART_REDIRECT >> 8);
                u8TempTxBuff[i++] = NXTY_PCCTRL_UART_REDIRECT;
                u8TempTxBuff[i++] = 0x00;                               
                u8TempTxBuff[i++] = 0x00;
                u8TempTxBuff[i++] = 0x00;
                u8TempTxBuff[i++] = 0x00;                                   // Set to 0 to go back local
            
                
                nxtyCurrentReq = NXTY_SUPER_MSG_SET_NU_PARAM;
                nxty.SendNxtyMsg(NXTY_SUPER_MSG_REQ, u8TempTxBuff, i);
            }
            
            // Start the spinner..
            bUniiUp = true;
            SpinnerStart( "", "Bypass CAC command sent to NU." );
            szSuccess = "Bypass CAC should now be set...";
            msgTimer = setTimeout(app.handleRespnose, 6000);
            retryObject = app.handleBypassCacKey;
        
        }
        else
        {
            SpinnerStop();
            showAlert("Bypass CAC not allowed...", "Bluetooth not connected.");
        }
    },

    
    // Handle the Register key response
    handleRespnose: function()
    {
        
        if( window.msgRxLastCmd == NXTY_NAK_RSP )
        {   
            retryCount = 0;
            
            if( nxtyLastNakType == NXTY_NAK_TYPE_CRC )
            {
                // CRC error
                showAlert("CRC error.", "Msg Error");
            }
            else if( nxtyLastNakType == NXTY_NAK_TYPE_UNII_NOT_UP )
            {
                // Unii not up
                showAlert("Fix UNII link and retry...", "UNII link down.");
            }
            else if( nxtyLastNakType == NXTY_NAK_TYPE_UNIT_REDIRECT )
            {
                // Unii up but UART redirect error
                showAlert("Redirect to NU failed.", "UNII link up.");
            }
            else if( nxtyLastNakType == NXTY_NAK_TYPE_TIMEOUT )
            {
                // Command timeout...
                showAlert("Timeout.  Make sure USB cable is not plugged in.", "Msg Error");                    
            } 
            else
            {
                showAlert("Unknown NAK error.  NAK=" + nxtyLastNakType, "Msg Error");
            }
        }
        else
        {
            if( nxtyRxStatusIcd <= 0x07 )
            {
                // Stop the spinner...
                SpinnerStop();
                
                if( window.msgRxLastCmd == NXTY_CONTROL_WRITE_RSP )
                {   
                    showAlert(szSuccess, "Success");
                }
            }
            else
            {
                if( iNxtySuperMsgRspStatus == NXTY_SUPER_MSG_STATUS_SUCCESS )
                {
                    // Stop the spinner...
                    SpinnerStop();
                    
                    showAlert(szSuccess, "Success");
                    retryCount = 0;
                }
                else
                {
                    retryCount++;
                    
                    if( retryCount < 4 )
                    {
//                        showAlert("V2 Super Message did not receive a successful response, retrying...", "Retrying");
                        PrintLog(1, "Retrying..." );
                        setTimeout(retryObject, 1000);
                    }
                    else
                    {
                        // Stop the spinner...
                        SpinnerStop();
                        
                        showAlert("V2 Super Message did not receive a successful response, no more retries...", "Failure");
                        retryCount = 0;
                    }
                }
            }                        
        }
        
        if( retryCount == 0 )
        {
            retryObject = null;
        }
    },



    

    renderHomeView: function() 
    {
//        var myBluetoothIcon = isSouthBoundIfCnx ? "<div id='bt_icon_id' class='bt_icon'>" + szSbIfIconOn + "</div>" : "<div  id='bt_icon_id' class='bt_icon'>" + szSbIfIconOff + "</div>";
//        var myBluetoothMain = isSouthBoundIfCnx ? "<div id='bt_main_id' class='bt_main_icon'>" + szSbIfMainOn + "</div>" : "<div  id='bt_main_id' class='bt_main_icon'>" + szSbIfMainOff + "</div>";
        
        {
            var myHtml = 

           "<div class='section'>" +
                "<div id='go_img_id' class='div_product'>" + "" +
                    "<div id='go_sn_id' class='text_producttitle'>" + guiSerialNumber + "</div>" +
                "</div>" +
                "<div class='onoffswitch'>" +
                    "<input type='checkbox' name='onoffswitch' class='onoffswitch-checkbox' id='myonoffswitch' onclick='clickFollow();'>" +
                    "<label class='onoffswitch-label' for='myonoffswitch'>" +
                        "<span class='onoffswitch-inner'></span>" +
                        "<span class='onoffswitch-switch'></span>" +
                    "</label>" +
                "</div>" +
                "<div class='div_footer'>" +
                    "<div class='text_version'>Version 1.0.1</div>" +
                    "<div class='div_footeroption'><a href='https://cel-fi.com/support/'><img src='img/HelpIcon.svg' alt='' class='image_footericon'></a></div>" +
                "</div>" +
           "</div>";
                    
//                "<img src='img/header_main.png' width='100%' />" +
                
//                myBluetoothIcon +
//                myBluetoothMain +
//                szMyRssiLine +
//                szMyStatusLine;
    
            $('body').html(myHtml); 
            

        }
        
/*        
        else
        {
            var myHtml = 
                "<img src='img/header_main.png' width='100%' />" +
                
                   myBluetoothIcon +
                   
                  "<button id='reg_button_id'         type='button' class='mybutton' onclick='app.handleRegKey()'>       <img src='img/button_Register.png' />          </button>" +
                "<button id='unreg_button_id'       type='button' class='mybutton' onclick='app.handleUnRegKey()'>     <img src='img/button_UnRegister.png' />        </button>" +
                "<button id='quick_lock_button_id'  type='button' class='mybutton' onclick='app.handleQLockKey()'>     <img src='img/button_QuickLocationLock.png' /> </button>" +
                "<button id='clear_lock_button_id'  type='button' class='mybutton' onclick='app.handleCLockKey()'>     <img src='img/button_ClearLocationLock.png' /> </button>" +
                "<button id='bypass_cac_button_id'  type='button' class='mybutton' onclick='app.handleBypassCacKey()'> <img src='img/button_BypassCac.png' />         </button>" +
                
    //            szMyRssiLine +
                szMyStatusLine;
                  
    
            $('body').html(myHtml); 
            
    
            // Make the buttons change when touched...    
             document.getElementById("reg_button_id").addEventListener('touchstart', HandleButtonDown );
             document.getElementById("reg_button_id").addEventListener('touchend',   HandleButtonUp );
    
            document.getElementById("unreg_button_id").addEventListener('touchstart', HandleButtonDown );
            document.getElementById("unreg_button_id").addEventListener('touchend',   HandleButtonUp );
    
            document.getElementById("quick_lock_button_id").addEventListener('touchstart', HandleButtonDown );
            document.getElementById("quick_lock_button_id").addEventListener('touchend',   HandleButtonUp );
    
            document.getElementById("clear_lock_button_id").addEventListener('touchstart', HandleButtonDown );
            document.getElementById("clear_lock_button_id").addEventListener('touchend',   HandleButtonUp );
    
            document.getElementById("bypass_cac_button_id").addEventListener('touchstart', HandleButtonDown );
            document.getElementById("bypass_cac_button_id").addEventListener('touchend',   HandleButtonUp );
            UpdateStatusLine( "MyWave ver: " + szVersion );
        
        }
*/      

        
        currentView = "main";
        SpinnerStart( "", GetLangString("SearchDevices") );  // "Searching for Cel-Fi Devices..."

        
//        UpdateRssiLine( -100 );               
        
    },


    initialize: function() 
    {
        if( ImRunningOnBrowser )
        {
            PrintLog(10, "running on browser");
    
    
            // Browser...
            window.isPhone = false;
            isRegistered   = false;
            this.onDeviceReady();
        }
        else
        {
             PrintLog(10, "running on phone");
             
            // On a phone....
            window.isPhone = true;
                         
            // Call onDeviceReady when PhoneGap is loaded.
            //
            // At this point, the document has loaded but phonegap-1.0.0.js has not.
            // When PhoneGap is loaded and talking with the native device,
            // it will call the event `deviceready`.
            // 
            document.addEventListener('deviceready', this.onDeviceReady, false);
        }

    },



};




//.................................................................................................................
function stringifyReplaceToHex(key, value) 
{
    for( var i = 0; i < value.length; i++ )
    {
        if(typeof value[i] === 'undefined')
        {
            value[i] = "undefined";
        }
        else
        {
            value[i] = "0x" + value[i].toString(16);
        }
    }
    return value;
}








// Follow.....................................................................
const   MAIN_LOOP_STATE_INIT      = 0;
const   MAIN_LOOP_STATE_OPERATE   = 1;
var     uMainLoopState            = MAIN_LOOP_STATE_INIT;
var     uMainLoopCounter          = 0;
var     MainLoopIntervalHandle    = null;
v
//.................................................................................................
function StartMainLoop()
{
    if( MainLoopIntervalHandle != null )
    {
        StopMainLoop();
    }
    
    PrintLog(1, "StartMainLoop()" );         
    MainLoopIntervalHandle = setInterval(MainLoop, 1000);
}


//.................................................................................................
function StopMainLoop()
{
    if( MainLoopIntervalHandle != null )
    {
        clearInterval(MainLoopIntervalHandle)
    }
    MainLoopIntervalHandle = null;
}


// MainLoop.......................................................................................
function MainLoop() 
{

    uMainLoopCounter++;
    PrintLog(1, "MainLoop: Counter=" + uMainLoopCounter );
    
    // --------------------------------------------------------------------
    switch(uMainLoopState)
    {
        case MAIN_LOOP_STATE_INIT:
        {
            
            if(bfileOpenLogFileSuccess == false )
            {
                PrintLog(1, "MainLoop: Init: Open File system...");
                OpenFileSystem();
            }
            else if(bfileOpenLogFileSuccess && (isSouthBoundIfCnx == false) )
            {
                if( isSouthBoundIfStarted == false )
                {
                    // Now that the file system is open, start SouthBound Interface...
                    PrintLog(1, "MainLoop: Init: Open Southbound IF system...");
                    OpenSouthBoundIf(true);
                }
            }
            else if(guiSerialNumber != "" )
            {
                if( guiNumDevicesFound )  // When set to 1 in BT file, we should have the SN by then.
                {
                    uMainLoopState = MAIN_LOOP_STATE_OPERATE;
                }
            }
            break;
        }
        
        case MAIN_LOOP_STATE_OPERATE:
        {
            PrintLog(1, "MainLoop: Operate: ...");
            UpdateStatusLine( "SN: " + guiSerialNumber);
            
            if( nxtyNuXferBufferAddr == -1 )
            {
                PrintLog(1, "MainLoop: Operate: Get Xfer Buffer Addr...");
                GetXferBufferAddr();
            }    
            else if( nxtyFollowTag == -1 )
            {
                GetFollowTag();
            }
            else if( nxtyFollowXarfcn == -1 )
            {
                GetFollowXarfcn();
            }
            else
            {
                SpinnerStop();
                StopMainLoop();
                DisconnectAndStopSouthBoundIf();

                bFollowMyPhoneFlag = false; 
                
                if( nxtyFollowTag != nxtyNuXferBufferAddr )
                {
                    
// jdo test                
// window.localStorage.setItem("phoneFollowTag_Id", nxtyFollowTag);
// jdo test
                    

                    document.getElementById("go_img_id").innerHTML = szImgG32;
                    document.getElementById("go_sn_id").innerHTML = guiSerialNumber;

                    // Cel-Fi hardware supports Follow My Phone, see if this phone has requested to follow:
                    phoneFollowTag = window.localStorage.getItem("phoneFollowTag_Id");
                    if( phoneFollowTag != null )
                    {
                        if( phoneFollowTag == nxtyFollowTag )
                        {
                            PrintLog(1, "Follow Tags match, enable Follow My Phone.");
                            SetFollow(true);
                        }
                        else
                        {
                            PrintLog(1, "Follow Tags do not match, disable Follow My Phone.");
                            SetFollow(false);
                        }
                        
                    }
                    else
                    {
                        PrintLog(1, "No Follow Tag stored on phone so disable Follow My Phone.");
                        SetFollow(false);
                    }
                }
                else
                {
                    PrintLog(1, "This Cel-Fi device does not support Follow My Phone" );
                    
                    navigator.notification.confirm(
                            GetLangString('NoFollowSupport'),    // message
                            HandleNoFollowConfirmation,  // callback to invoke with index of button pressed
                            "Cel-Fi SN: " + guiSerialNumber,       // title
                            ['Try Again'] );                       // buttonLabels
                }
            }
            break;
        }

    }        
}
        
        
 


function HandleNoFollowConfirmation(buttonIndex)
{
    // buttonIndex = 0 if dialog dismissed, i.e. back button pressed.
    // buttonIndex = 1 if 'Ok'
    if( (buttonIndex == 0) || (buttonIndex == 1) )
    {
        // Ok...
        DisconnectAndStopSouthBoundIf();
        setTimeout(restartApp, 2000);    // Allow BT to disconnect...
    }
}




//-------------------------------------------------------------------------------------------------------
const   FOLLOW_STATE_INIT       = 0;
const   FOLLOW_STATE_SET_TAG    = 1;
const   FOLLOW_STATE_GET_TAG    = 2;
const   FOLLOW_STATE_SET_XARFCN = 3;
const   FOLLOW_STATE_VERIFY     = 4;
const   FOLLOW_STATE_DONE       = 5;
const   FOLLOW_STATE_WORK       = 100;
var     followState             = FOLLOW_STATE_INIT;
var     followStateCounter      = 0;

function FollowMyPhone(myState, mySetTag)
{
    if( myState == FOLLOW_STATE_INIT)
    {
        followState        = myState;
        followStateCounter = 0;
    }

//    PrintLog(1, "Follow State counter =" + followStateCounter);

    if(locationEnabled)
    {
        switch(followState)
        {
            case FOLLOW_STATE_INIT:
            {
                PrintLog(1, "Follow State Init");
                
                if(isSouthBoundIfCnx)
                {
                    // Wait for BT to become disconnected....
                    setTimeout( function(){ FollowMyPhone(FOLLOW_STATE_WORK, mySetTag); }, 1000 );  // Come back in 1 second
                    return;
                }
                else
                {
                    ConnectBluetoothDevice(myLastBtAddress);
                }
                
                phoneFollowTag = window.localStorage.getItem("phoneFollowTag_Id");

                phony.getCellInfo(
                        
                        function(info)        // Success
                        {
                            PrintLog(1, "Telephony: " + JSON.stringify(info)); 
                            UpdateStatusLine("CellInfo: " + info.cellInfo);  // follow
                        },
                        function(err)               // Fail
                        {
                            PrintLog(99, "Telephony Err: " + err.toString() );
                            showAlert("Telephony Plugin", JSON.stringify(err) );
                        }
                    );  // follow

                if( mySetTag == 0)
                {
                    followState = FOLLOW_STATE_GET_TAG;
                }
                else
                {
                    followState = FOLLOW_STATE_SET_TAG;
                }
                break;
            }
            
            case FOLLOW_STATE_SET_TAG:
            {
                if(isSouthBoundIfCnx)
                {
                    PrintLog(1, "Follow State Set Tag");
                    nxtyFollowTag = -1;
                    SetFollowTag(mySetTag);
                    followState = FOLLOW_STATE_SET_XARFCN;
                }
                break;
            }
            
            case FOLLOW_STATE_GET_TAG:
            {
                if(isSouthBoundIfCnx)
                {
                    PrintLog(1, "Follow State Get Tag");
                    nxtyFollowTag = -1;
                    GetFollowTag();
                    followState = FOLLOW_STATE_SET_XARFCN;
                }
                break;
            }

            case FOLLOW_STATE_SET_XARFCN:
            {
                PrintLog(1, "Follow State Set Xarfcn");
                
                if( (isSouthBoundIfCnx == true) && (nxtyFollowTag != -1) )
                {
                    if( phoneFollowTag == nxtyFollowTag )
                    {
                        SetFollowXarfcn(0x12345678);
                    }
                    else
                    {
                        PrintLog(1, "Follow Tag no longer matches, disable Follow My Phone");
                        bFollowMyPhoneFlag = false;
                        SimpleTimer.stop(onStopped);
                        
                    }
                    followState = FOLLOW_STATE_VERIFY;
                }
                break;
            }
            case FOLLOW_STATE_VERIFY:
            {
                PrintLog(1, "Follow State Verify");
                followState = FOLLOW_STATE_DONE;
                break;
            }
            
            case FOLLOW_STATE_DONE:
            {
                PrintLog(1, "Follow State Done");
                DisconnectAndStopSouthBoundIf();
                return;
            }
            
        }

        
        if( (followState <= FOLLOW_STATE_DONE) )
        {
            if( followStateCounter < 9)
            {
                setTimeout( function(){ FollowMyPhone(FOLLOW_STATE_WORK, mySetTag); }, 1000 );  // Come back in 1 second
            }
            else
            {
                PrintLog(99, "Follow State timed out..."); 
                if( isSouthBoundIfCnx )
                {
                    DisconnectAndStopSouthBoundIf();
                }
            }
        }
        followStateCounter++;

    }
    else
    {
        UpdateStatusLine("location not enabled");  // follow
    }
   
    
}


//-------------------------------------------------------------------------------------------------------
function clickFollow()
{
    if (document.getElementById('myonoffswitch').checked) 
    {
        SetFollow(true);
    } 
    else 
    {
        SetFollow(false);
    }
}


//-------------------------------------------------------------------------------------------------------
function SetFollow(myState)
{
    if( myState == true )
    {
        
        // Create random tag between 0 and 0x7FFFFFFF
        var randomTag = Math.random() * 0x7FFFFFFF; 

        randomTag >>>= 0;   // Use >>> operator to make unsiged.

        PrintLog(1, "Start Following: tag = 0x" + randomTag.toString(16) );
        window.localStorage.setItem("phoneFollowTag_Id", randomTag);    // Remember locally
        FollowMyPhone(FOLLOW_STATE_INIT, randomTag);                    // Call right away to give the tag to the hardware.
        
        RememberThisDevice(guiDeviceMacAddrList[btCnxIdIdx], icdBtList[btCnxIdIdx], guiDeviceRssiList[btCnxIdIdx] );

        // Start a timer that can run from background...
        var config = {
            interval: 30000, // 30 seconds
            useWakelock: false
        }
        
        // Start
        SimpleTimer.start(onTimerTick, errorStart, config);
    }
    else
    {
        PrintLog(1, "Do not follow...");
        SimpleTimer.stop(onStopped);
        ForgetThisDevice();                                     // Forget this BT device.
        window.localStorage.removeItem( "phoneFollowTag_Id" );  // Delete the follow tag stored on the phone.
    }
    
    bFollowMyPhoneFlag = myState; 
    document.getElementById("myonoffswitch").checked = myState;
}









// -------------------------------------------------------------------------------------------------------
function onTimerTick() 
{
    PrintLog(1, "\r\nTimer Tick----------------------------------------------");
    FollowMyPhone(FOLLOW_STATE_INIT, 0);
}    

function errorStart(message) {
    PrintLog(1, 'timer start failed: ' + message);
}

function onStopped() {
    PrintLog(1, 'timer is stopped');
}

