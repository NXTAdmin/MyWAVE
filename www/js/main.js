//=================================================================================================
//
//  File: main.js
//
//  Description:  Main file for app.
//
//  Version:
//  2/1/19:  00.00.01:   Initial Test release
//  08/12/20: 00.01.02:  Set min SDK from 28 to 21 to allow older Android phones.
//                       Added 128 x 128 ICON.
//                       Added testing text.
//  08/24/20: 00.01.03:  Added slide detection for slider.
//                       Added "Status: On/Off/Following" below slider.
//                       Removed screen bouncing when touched.  Due to version CSS setting width incorrectly.
//                       Switched to native spinner instead of plugin.
//                       Modified timer tick to just move state machine along and not re-init.
//                         - When phone in standby mode, timer tick does not run for very long.
//  09/03/20: 00.01.04:  Added a timeout to gracefully handle an error when in standby.
//  09/14/20: 01.00.06:  Added logic to display a popup, if Android 10 or later, to go to the 
//                       settings page and for the MyWave app set location permissions to "Allow all of the time"
//                       so that cell data can be collected while in standby.
//                       Added check to remind user to set MyWave app's location permission to "Allow all of the time" if
//                       cell data could not be acquired during standby.  The alert pops up when app comes back to foreground.
//  09/29/20: 01.00.07:  Removed Android debug statement.
//                       Removed Xarfcn text. 
//  10/02/20: 01.00.08:  Changed "Android 6.0+ requires..." to "7.0+" since min use is 7.0.
//                       Change minSdkVersion to 24, Android 7.0.
//                       Added bw:xxxx, LTE is 5,10,15,20 MHz and WCDMA is fixed at 5MHz.                       
//  10/07/20: 01.00.09:  Protect getBandwidth() in plugin since new with API 28.  So Android 9 and up are allowed to call getBandwidth().
//               TODO    
//
//  To Do:
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
var szVersion               = "01.91.09";


var szSuccess               = "";
var retryObject             = null;
var retryCount              = 0;
var bSpinner                = false;
var szNoStatus              = "No status response from unit so ICD version not known...kill app and retry";
var bCnxToCu                = true;             // Set to true if connected locally to CU after reading local BoardConfig.
var bCnxToOneBoxNu          = false;            // Set to true if connected to a 1-Box NU, all UART redirects are disabled.
var bAllowAllTheTime        = true;             // Set to false if Android >= 10 and Cell info returns empth.

var bPhoneInBackground      = false;    // Set to true if phone is in background.
var bFollowMyPhoneFlag      = false;    // Set to true when phone is in Follow My Phone mode.
var phoneFollowTag          = null;     // 32 bit random number generated by the phone and sent to the GO and stored on phone in guiXarfcn_Id.
var phoneFollowXarfcn       = 0;        // The Xarfcn value that the phone is currently camped on.  Add 0x80000000 if LTE.
var FollowMyPhoneTimer      = null;
const XARFCN_LTE_BIT        = 0x80000000;

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
//    window.plugins.spinnerDialog.show(null, msg, true);
    navigator.notification.activityStart(title, msg);
    bSpinner = true;
    
    // Save to log file...
    PrintLog(1, "Spinner: " + msg );
    
}

// SpinnerStop........................................................................................
function SpinnerStop()
{
    if( bSpinner )
    {
//        window.plugins.spinnerDialog.hide();
        navigator.notification.activityStop();
        bSpinner = false;
    }
}



function showAlert( title, message ) 
{
    PrintLog(1, "ShowAlert: Title=" + title + " msg=" + message );
  
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
        document.addEventListener("resume", HandlePhoneForeground, false);

        
        app.renderHomeView();
        
        
        if( window.device.platform == iOSPlatform )
        {
            if (parseFloat(window.device.version) >= 7.0) 
            {
                StatusBar.hide();
            }
        } 
        
  
        // Add logic to detect a finger slide..
        var slideContainer = document.querySelector(".onoffswitch");  // Select the ID

        slideContainer.addEventListener("touchstart", startTouch, false);
        slideContainer.addEventListener("touchmove", moveTouch, false);
        
        
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
            showAlert( "Back", "Back to where?" );
        }
        
    },

    

    renderHomeView: function() 
    {

        var myHtml = 

           "<div class='section'>" +
                "<div id='go_img_id' class='div_product'>" + "" +
                    "<div id='go_sn_id' class='text_producttitle'>" + guiSerialNumber + "</div>" +
                "</div>" +
                    
                "<div>" +
                    "<div class='onoffswitch'>" +
                        "<input type='checkbox' name='onoffswitch' class='onoffswitch-checkbox' id='myonoffswitch' onclick='clickFollow();'>" +
                        "<label  id='onofflabel_id' class='onoffswitch-label' for='myonoffswitch'>" +
                            "<span  class='onoffswitch-inner'></span>" +
                            "<span class='onoffswitch-switch'></span>" +
                        "</label>" +
                    "</div>" +

                    "<div id='follow_text_id' class='text_follow'>Status: Off</div>" +
                "</div>" +

// Enable test display                
                "<div>" +
                    "<div id='phone_x_id'  class='text_test'>Phone Xarfcn:</div>" +
                    "<div id='sent_x_id'   class='text_test'>Sent to GO:</div>" +
                    "<div id='current_x_id' class='text_test'>Current GO Xarfcn:</div>" +
                  "</div>" +
                        

                
                "<div class='div_footer'>" +
                    "<div class='text_version'>Version: " + szVersion + "</div>" +
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
// Swipe  Left / Right detection 
var initialX = null;

function startTouch(e) 
{
  initialX = e.touches[0].clientX;
};

function moveTouch(e) 
{
  if (initialX === null) {
    return;
  }

  var currentX = e.touches[0].clientX;
  var diffX = initialX - currentX;

  // sliding horizontally
  if (diffX > 0) 
  {
    // swiped left
    document.getElementById('myonoffswitch').checked = false;
  } 
  else 
  {
    // swiped right
    document.getElementById('myonoffswitch').checked = true;
  }  

  clickFollow();
  initialX = null;

  e.preventDefault();
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
                    GetLocation();
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
                GetFollowAndCurrentXarfcn();
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
                    

                    if( guiProductType == PRODUCT_TYPE_GO )
                    {
                        document.getElementById("go_img_id").innerHTML = szImgG31;
                    }
                    else
                    {
                        document.getElementById("go_img_id").innerHTML = szImgG32;
                    }
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
var     followState             = FOLLOW_STATE_INIT;
var     followStateCounter      = 0;
var     followInitMs            = 0;

function FollowMyPhone( bStart, mySetTag)
{
    if( bStart )
    {
        followState        = FOLLOW_STATE_INIT;
        followStateCounter = 0;
    }


    // Make sure that no other timers are pending....
    if( FollowMyPhoneTimer != null)
    {
        clearTimeout(FollowMyPhoneTimer);
        FollowMyPhoneTimer = null;  
    }

    var stateText = followState.toString();
    switch(followState)
    {
        case FOLLOW_STATE_INIT:         stateText = "INIT";         break;
        case FOLLOW_STATE_SET_TAG:      stateText = "SET_TAG";      break;
        case FOLLOW_STATE_GET_TAG:      stateText = "GET_TAG";      break;
        case FOLLOW_STATE_SET_XARFCN:   stateText = "SET_XARFCN";   break;
        case FOLLOW_STATE_VERIFY:       stateText = "VERIFY";       break;
        case FOLLOW_STATE_DONE:         stateText = "DONE";         break;
    }
    
    PrintLog(1, "Follow State=" + stateText + " counter=" + followStateCounter );

    if(locationEnabled)
    {
        switch(followState)
        {
            case FOLLOW_STATE_INIT:
            {
                PrintLog(1, "Follow State: Init");
                var d = new Date();
                followInitMs = d.getTime();
                
                if(isSouthBoundIfCnx)
                {
                    // Wait for BT to become disconnected....
                    if( mySetTag == 0) // Called from timer tick...
                    {
                        PrintLog(1, "  - BT connected, try to disconnect since called from timer...");
                        DisconnectAndStopSouthBoundIf();
                    }
                    else
                    {
                        PrintLog(1, "  - BT connected, come back and try again...");
                        FollowMyPhoneTimer = setTimeout( function(){ FollowMyPhone(false, mySetTag); }, 1000 );  // Come back in 1 second
                    }
                    return;
                }
                else
                {
                    ConnectBluetoothDevice(myLastBtAddress);
                }
                
                phoneFollowTag    = window.localStorage.getItem("phoneFollowTag_Id");
                phoneFollowXarfcn = 0;
                
                phony.getCellInfo(
                        
                        function(info)        // Success
                        {
                            // Return looks like: "cellInfo":"tech:LTE fcn:66536 isReg:true dbm:-105 bw:20000, tech:WCDMA fcn:66536 isReg:false dbm:-111 bw:5000"  
                            //   or               "cellInfo":"getAllCellInfo returned null." if no cells available.
                            //   or               "cellInfo":"getAllCellInfo returned empty." if app Location permission is not set to "Allow all the time".  New with Android 10.
                            var cells = info.cellInfo.split(",");

                            if( cells[0] == "getAllCellInfo returned empty.")
                            {
                                if( (window.device.platform == androidPlatform) && (parseInt(window.device.version, 10) >= 10)  ) 
                                {
                                    bAllowAllTheTime = false;
                                    PrintLog(1, "Telephony: " + JSON.stringify(info) + " Verify that app Location permission is set to \"Allow all the time\".");
                                }
                                else
                                {
                                    PrintLog(1, "Telephony: " + JSON.stringify(info) + " Android version < 10 so do not know why this occurred.");
                                }
                            }
                            else
                            {
                                PrintLog(1, "Telephony: " + JSON.stringify(info));
                            }
                            
                            for( var i = 0; i < cells.length; i++ )
                            {
                                PrintLog(1, "Cell: " + cells[i] );
                                
                                var cellData = cells[i].split(" ");  // cellData[0] = tech:LTE etc
                                var cellTech = cellData[0].split(":");
                                
                                if( cellTech[0] == "tech"  )
                                {
                                    var cellFnc  = cellData[1].split(":");
                                    var cellReg  = cellData[2].split(":");
                                    
                                    if( cellReg[1] == "true" )
                                    {
                                        phoneFollowXarfcn = parseInt(cellFnc[1]);  // Convert the string to a number.
                                        
                                        // If LTE OR with 0x80000000 so GO knows LTE.
                                        if( cellTech[1] == "LTE" )
                                        {
                                            phoneFollowXarfcn |= 0x80000000;
                                            
                                            var cellBw   = cellData[3].split(":");
                                            var uBw = parseInt(cellBw[1]);  // Convert the string to a number.
                                            
                                            // bit 27=bBwValid, bit24/25 is the bandwidth (00=5MHz, 01=10MHz, 10=15MHz, 11=20MHz)
                                            // uBw = 0x7FFFFFFF (2147483647) UNAVAILABLE
                                            if( uBw == 5000 )
                                            {
                                                phoneFollowXarfcn |= 0x08000000;    // 1000: Valid 5MHz
                                            }
                                            else if( uBw == 10000 )
                                            {
                                                phoneFollowXarfcn |= 0x09000000;   // 1001: Valid 10MHz
                                            }
                                            else if( uBw == 15000 )
                                            {
                                                phoneFollowXarfcn |= 0x0A000000;   // 1010: Valid 15MHz
                                            }
                                            else if( uBw == 20000 )
                                            {
                                                phoneFollowXarfcn |= 0x0B000000;   // 1011: Valid 20MHz
                                            }
                                        }
                                        
                                        phoneFollowXarfcn >>>= 0;  // Make unsigned.
                                        PrintLog(1, "Phone Xarfcn = 0x" + phoneFollowXarfcn.toString(16) );
                                    }
                                }
                            }
                            
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
                    PrintLog(1, "Follow State: Set Tag");
                    nxtyFollowTag = -1;
                    SetFollowTag(mySetTag);
                    followState = FOLLOW_STATE_SET_XARFCN;
                }
                else
                {
                    var d = new Date();
                    if( (d.getTime() - followInitMs) > (20 * 1000) )
                    {
                        PrintLog(1, "Follow State: Set Tag: More than 20 seconds and still no BT connection, reinit.");
                        FollowMyPhone(true, mySetTag);
                    }
                }
                break;
            }
            
            case FOLLOW_STATE_GET_TAG:
            {
                if(isSouthBoundIfCnx)
                {
                    PrintLog(1, "Follow State: Get Tag");
                    nxtyFollowTag = -1;
                    GetFollowTag();
                    followState = FOLLOW_STATE_SET_XARFCN;
                }
                else
                {
                    var d = new Date();
                    if( (d.getTime() - followInitMs) > (20 * 1000) )
                    {
                        PrintLog(1, "Follow State: Get Tag: More than 20 seconds and still no BT connection, reinit.");
                        FollowMyPhone(true, mySetTag);
                    }
                }
                break;
            }

            case FOLLOW_STATE_SET_XARFCN:
            {
                PrintLog(1, "Follow State: Set Xarfcn");
                
                if( (isSouthBoundIfCnx == true) && (nxtyFollowTag != -1) )
                {
                    followState = FOLLOW_STATE_DONE;

                    if( phoneFollowTag == nxtyFollowTag )
                    {
                        if( phoneFollowXarfcn != 0 )
                        {
                            PrintLog(1, "  - Phone's Follow Tag matches GO's Follow Tag so set the Xarfcn to 0x" + phoneFollowXarfcn.toString(16) );
                            SetFollowXarfcn(phoneFollowXarfcn);
                            followState = FOLLOW_STATE_VERIFY;
                        }
                        else
                        {
                            PrintLog(1, "  - Phone's Follow Tag matches GO's Follow Tag but Xarfcn is 0 so do not set." );
                        }
                    }
                    else
                    {
                        PrintLog(1, "Follow Tag no longer matches, disable Follow My Phone");
                        SetFollow(false);
                    }
                }
                break;
            }
            case FOLLOW_STATE_VERIFY:
            {
                PrintLog(1, "Follow State: Verify");
                
                // No need to verigy anything...it either worked and we move on or it failed and we move on to update next time.  No retry here.
                GetFollowAndCurrentXarfcn();  // Simply get the status before disconnecting in case we want to display
                followState = FOLLOW_STATE_DONE;
                break;
            }
            
            case FOLLOW_STATE_DONE:
            {
                PrintLog(1, "Follow State: Done");
                
//  Disable test display                
                // Start test display------------------------------------------------------------------------------
                // Update the test information...
                var varTemp = phoneFollowXarfcn;
                var outText = "Phone Xarfcn: ";
                if( varTemp & XARFCN_LTE_BIT )
                {
                    varTemp &= ~XARFCN_LTE_BIT;
                    outText += "LTE: "
                }
                document.getElementById("phone_x_id").innerHTML = outText + " 0x" + varTemp.toString(16);
                
                
                varTemp = nxtyFollowXarfcn;
                outText = "Sent to GO: ";
                if( varTemp & XARFCN_LTE_BIT )
                {
                    varTemp &= ~XARFCN_LTE_BIT;
                    outText += "LTE: "
                }
                document.getElementById("sent_x_id").innerHTML = outText + " 0x" + varTemp.toString(16);
                
                varTemp = nxtyCurrentXarfcn;
                outText = "Current GO Xarfcn: ";
                if( varTemp & XARFCN_LTE_BIT )
                {
                    varTemp &= ~XARFCN_LTE_BIT;
                    outText += "LTE: "
                }
                document.getElementById("current_x_id").innerHTML = outText + " 0x" + varTemp.toString(16);
                // End test display------------------------------------------------------------------------------
//
                
                if( (phoneFollowXarfcn != 0) && (phoneFollowXarfcn == nxtyCurrentXarfcn) )
                {
                    PrintLog(1, "Follow: Phone=0x" + phoneFollowXarfcn.toString(16) + "  Go request=0x" + nxtyFollowXarfcn.toString(16) + "  Go Current=0x" + nxtyCurrentXarfcn.toString(16) );
                    SetFollowText( "Following" );
                }
                else
                {
                    PrintLog(1, "Follow: Phone=0x" + phoneFollowXarfcn.toString(16) + "  Go request=0x" + nxtyFollowXarfcn.toString(16) + "  Go Current=0x" + nxtyCurrentXarfcn.toString(16) + "  Not following." );
                    SetFollowText( "On" );
                }

                
                DisconnectAndStopSouthBoundIf();

                // Next time restart....
                followState        = FOLLOW_STATE_INIT;
                followStateCounter = 0;
                return;
            }
            
        }

        
        if( (followState <= FOLLOW_STATE_DONE) )
        {
            if( followStateCounter < 9)
            {
                FollowMyPhoneTimer = setTimeout( function(){ FollowMyPhone(false, mySetTag); }, 1000 );  // Come back in 1 second
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
                    StopSimpleTimer();

                    // Start a timer that can run from background...
                    setTimeout( function(){ StartSimpleTimer(30); }, 700 );
                    
                    // Next time restart....
                    followState        = FOLLOW_STATE_INIT;
                    followStateCounter = 0;

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
function SetFollowText(myText)
{
    PrintLog(1, "SetFollowText(" + myText + ")" );
    document.getElementById('follow_text_id').innerHTML = "Status: " + myText;
    
}

//-------------------------------------------------------------------------------------------------------
function SetFollow(myState)
{
    PrintLog(1, "SetFollow(" + myState + ")" );

    if( myState != bFollowMyPhoneFlag )
    {
        if( myState == true )
        {
    
            // Create random tag between 0 and 0x7FFFFFFF
            var randomTag = Math.random() * 0x7FFFFFFF; 
    
            randomTag >>>= 0;   // Use >>> operator to make unsiged.
    
            PrintLog(1, "Start Following: tag = 0x" + randomTag.toString(16) );
            window.localStorage.setItem("phoneFollowTag_Id", randomTag);    // Remember locally
            FollowMyPhone(true, randomTag);                    // Call right away to give the tag to the hardware.
            
            RememberThisDevice(guiDeviceMacAddrList[btCnxIdIdx], icdBtList[btCnxIdIdx], guiDeviceRssiList[btCnxIdIdx] );
            SetFollowText( "On");
            
            // Start a timer that can run from background...
            StartSimpleTimer(30);
            
        }
        else
        {
            PrintLog(1, "Do not follow...");
            StopSimpleTimer();
            ForgetThisDevice();                                     // Forget this BT device.
            window.localStorage.removeItem( "phoneFollowTag_Id" );  // Delete the follow tag stored on the phone.
            SetFollowText( "Off");
        }
        
        
        bFollowMyPhoneFlag = myState; 
        document.getElementById("myonoffswitch").checked = myState;
    }
    else
    {
        PrintLog(1, "  No action required.  Current follow state = " + bFollowMyPhoneFlag);
    }
    
    
}









// -------------------------------------------------------------------------------------------------------
// Runs at the Android level, even in backgroud or when app is asleep...
//
function StartSimpleTimer( myTimerSec )
{
    var timerMs = 30000;    // Min is 30 seconds...
    
    PrintLog(1, "StartSimpleTimer(" + myTimerSec + ")" );
    
    if( myTimerSec > 30 )
    {
        timerMs = myTimerSec * 1000;
    }
    
    var config = {
            interval: timerMs, 
            useWakelock: false
        }
    SimpleTimer.start(onTimerTick, errorStart, config);
}

function StopSimpleTimer()
{
    SimpleTimer.stop(onStopped);
}

function onTimerTick() 
{
    PrintLog(1, "\r\nTimer Tick----------------------------------------------");
//    FollowMyPhone(true, 0);  // Init: Called from timer tick........
    FollowMyPhone(false, 0);  // Where we left off: Called from timer tick........
}    

function errorStart(message) 
{
    PrintLog(1, 'timer start failed: ' + message);
}

function onStopped() 
{
    PrintLog(1, 'Simple Timer is stopped');
}



//GetLocation.......................................................................................
function GetLocation() 
{
    PrintLog(1, "GetLocation() - locationEnabled = " + locationEnabled );
    if(locationEnabled) 
    {
        navigator.geolocation.getCurrentPosition(getLocationSuccess, getLocationError, {timeout:30000});
    }    
}

function getLocationSuccess(position) 
{
    PrintLog(1, "GetLocation() success lat=" + position.coords.latitude + " long=" + position.coords.longitude );

/*    
 alert('Latitude: '          + position.coords.latitude          + '\n' +
       'Longitude: '         + position.coords.longitude         + '\n' +
       'Altitude: '          + position.coords.altitude          + '\n' +
       'Accuracy: '          + position.coords.accuracy          + '\n' +
       'Altitude Accuracy: ' + position.coords.altitudeAccuracy  + '\n' +
       'Heading: '           + position.coords.heading           + '\n' +
       'Speed: '             + position.coords.speed             + '\n' +
       'Timestamp: '         + position.timestamp                + '\n');
*/          
}


function getLocationError(error) 
{
    PrintLog(99, "GetLocation() Error=" + error.message + "  code=" + error.code  );
}

