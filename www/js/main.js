//=================================================================================================
//
//  File: main.js
//
//  Description:  Main file for app.
//
//  Version:
//  2/1/19:  00.00.01:   Initial Test release
//
//=================================================================================================


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
        
        window.plugins.insomnia.keepAwake( successAcquirePowerManagement, failAcquirePowerManagement );            //
    },   
       
       

    // Handle the back button
    //
    onBackKeyDown: function() 
    {
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

    

    renderHomeView: function() 
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
                    
        $('body').html(myHtml); 
        
     
        currentView = "main";

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








// Mainloop() for Follow My Phone .....................................................................
const   MAIN_LOOP_STATE_INIT      = 0;
const   MAIN_LOOP_STATE_OPERATE   = 1;
var     uMainLoopState            = MAIN_LOOP_STATE_INIT;
var     uMainLoopCounter          = 0;
var     MainLoopIntervalHandle    = null;
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
    
    if( uMainLoopCounter > 20 )
    {
        PrintLog(1, "MainLoop: Counter=" + uMainLoopCounter );  // Print a feel good just in case nothing is happening...
    }
    
    // --------------------------------------------------------------------
    switch(uMainLoopState)
    {
        case MAIN_LOOP_STATE_INIT:
        {
            
            if(bfileOpenLogFileSuccess == false )
            {
                SpinnerStart( "", GetLangString("SearchDevices") );  // "Searching for Cel-Fi Devices..."

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
                        SetFollow(false);
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
                if( isSouthBoundIfCnx )
                {
                    PrintLog(99, "Follow State timed out after connecting to SN: " + guiSerialNumber ); 
                    DisconnectAndStopSouthBoundIf();
                }
                else
                {
                    PrintLog(1, "Follow State timed out because it could not connect to SN: " + guiSerialNumber );
                    PrintLog(1, "Shifting timing to make sure that we are not in sync with another connection." );
                    SimpleTimer.stop(onStopped);

                    // Start a timer that can run from background...
                    var config = {
                        interval: 30000, // 30 seconds
                        useWakelock: false
                    }
                    SimpleTimer.start(onTimerTick, errorStart, config);
                    
                }
            }
        }
        followStateCounter++;

    }
    else
    {
        PrintLog(1, "Location not enabled");
    }
   
    
}


//-------------------------------------------------------------------------------------------------------
function clickFollow()
{
    if (document.getElementById('myonoffswitch').checked) 
    {
        PrintLog(1, "\r\nUser pressed Follow----------------------------------------------");
        SetFollow(true);
    } 
    else 
    {
        PrintLog(1, "\r\nUser pressed No Follow----------------------------------------------");
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

