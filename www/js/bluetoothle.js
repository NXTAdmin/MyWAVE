//=================================================================================================
//
//  File: bluetoothle.js
//
//  Description:  This file contains all functionality to connect and maintain a connection
//                to a Nextivity bluetoothle device.
//
//
//                External functionality that must be maintained to support the SouthBound IF concept:
//
//                - OpenSouthBoundIf()
//                - ConnectSouthBoundIf()
//                - WriteSouthBoundData()
//                - Response data must call function nxty.ProcessNxtyRxMsg().
//                - CnxAndIdentifySouthBoundDevice()
//                - RefreshSouthBoundIf()
//
//                - Flags
//                  - isSouthBoundIfStarted:    Check is isSouthBoundIfEnabled after isShouthBoundIfStarted is true...
//                  - isSouthBoundIfEnabled:
//                  - isSouthBoundIfListDone:
//                  - isSouthBoundIfCnx:        Set "true" or "false" accordingly.
//                  - bSouthBoundWriteError;    true if write error.
//
//                - Messages
//                  - szSouthBoundIfEnableMsg
//                  - szSouthBoundIfNotCnxMsg
//                  - szSouthBoundIfInfoMsg
//
//=================================================================================================
//
//
//
//  bluetooth LE functions for the Rand Dusing Phonegap Plugin
//
//  Flow:
//
//    OpenSouthBoundIf()     (Called from main...)
//      bluetoothle.initialize(initializeSuccess, initializeError, paramsObj)
//        initializeSuccess()
//          BluetoothLoop()
//
//    BluetoothLoop()         (Called every 5 sec if not cnx, 15 sec if cnx)
//      bluetoothle.isConnected( isConnectedCallback )
//        isConnectedCallback()
//          if connected
//            UpdateBluetoothIcon(true)
//            setTimeout(BluetoothLoop, 15000)
//            if not subscribed
//              DiscoverBluetoothdevice()
//          else
//            UpdateBluetothIcon(false)
//            setTimeout(BluetoothLoop, 5000)
//            StartBluetoothScan()
//          end
//
//    StartBluetoothScan()
//      bluetoothle.startScan(startScanSuccess, startScanError, paramsObj)
//        startScanSuccess()
//          bluetoothle.stopScan(stopScanSuccess, stopScanError)
//          ConnectBluetoothDevice(obj.address)
//
//    ConnectBluetoothDevice(address)
//      bluetoothle.connect(connectSuccess, connectError, paramsObj)
//        connectSuccess()
//          UpdateBluetoothIcon(true)
//          DiscoverBluetoothDevice()
//
//
//    DiscoverBluetoothDevice()
//      if IOS
//        bluetoothle.services(servicesIosSuccess, servicesIosError, paramsObj);
//          servicesIosSuccess()
//            bluetoothle.characteristics(characteristicsIosSuccess, characteristicsIosError, paramsObj);
//              characteristicsIosSuccess()
//                if Tx Characteristic
//                  bluetoothle.descriptors(descriptorsIosTxSuccess, descriptorsIosTxError, paramsObj);
//                else if Rx Characteristic
//                  bluetoothle.descriptors(descriptorsIosRxSuccess, descriptorsIosRxError, paramsObj);
//
//        descriptorsIosTxSuccess()
//          SubscribeBluetoothDevice()
//
//        descriptorsIosRxSuccess()
//          do nothing
//
//      else if Android
//        bluetoothle.discover(discoverSuccess, discoverError)
//          discoverSuccess()
//            SubscribeBluetoothDevice()
//      end
//
//
//    SubscribeBluetoothDevice()
//      bluetoothle.subscribe(subscribeSuccess, subscribeError, paramsObj)
//
//
//    Rx processing............................................
//    subscribeSuccess()
//      ProcessNxtyRxMsg()
//
//
//


//const   BOARD_CFG_CABLE_BOX_BIT       = 0x4000;   // Bit 14 means cable box
const   BOARD_CFG_USE_THIS_DEVICE     = 0x0000;   // Set to 0 for non-cable box, or 0x4000 for cable box.  

                        
// Use the following global variables to determine South Bound IF status.
var isSouthBoundIfStarted   = false;    // Check if isSouthBoundIfEnabled after isShouthBoundIfStarted is true...
var isSouthBoundIfEnabled   = false;
var isSouthBoundIfCnx       = false;
var bSouthBoundWriteError   = false;
var bSouthBoundSkalCnx      = false;    // True if BT connected to Skal
var isSouthBoundIfListDone  = false;
var SouthBoundCnxErrorCount = 0;
var bBtIcdVer2              = false;    // True if BT ICD version is 2 which means no PIC-ICD messages and tech data is ID-VAL.
var bUseIdValTechData       = false;    // True if running on BtIcdVer2.
var bUseThunkLayer          = false;    // Convert ICD msgs to debug messages
var szSouthBoundIfEnableMsg = GetLangString("SouthBoundIfEnableMsgBT");     // "Bluetooth Required: Please Enable...";
var szSouthBoundIfNotCnxMsg = GetLangString("SouthBoundIfNotCnxMsgBT");     //  "Bluetooth connection lost.";
// var szSouthBoundIfInfoMsg   = GetLangString("SouthBoundIfInfoMsgBT");       // "Indicates if connected to Cel-Fi device via Bluetooth.\nBlue means connected.\nGray means not connected.\nCurrent status: ";


var addressKey      = "address";
var btAddr          = null;   // Version 2.0.0 requires address for many functions.
var myLastBtAddress = null;
var bMonitorBt      = false;
var uNoBtCount      = 0;

// const   TX_MAX_BYTES_PER_CONN           = 20;
const   TX_MAX_BYTES_PER_BUFFER         = 20;       // Android has 4 Tx buffers, IOS has 6 Tx buffers.
const   BT_CONNECTION_INTERVAL_DEFAULT  = 40;       // Android should agree to 20 mS and IOS should agree to 30 mS
var     btCnxInterval                   = BT_CONNECTION_INTERVAL_DEFAULT;
var     maxPhoneBuffer                  = 7;        // Download message is 132 bytes which takes 7 20-byte buffers or 6 22-byte buffers.
var     bBtTryingToCnx                  = false;    // Used for BT status while trying to connect. true:  ConnectBluetoothDevice() to CloseBluetoothDevice() 
                                                    // isSouthBoundIfCnx is used for connected and subscribed.
var     bBtCnxWhenBackground            = false;    // Set to true if BT is connected when phone sent to background.

//var bridgeServiceUuid           = "6734";

// 128-bit UUID must include the dashes.
var myAdvertisingUuid         = "48d60a60-f000-11e3-b42d-0002a5d5c51b";

// Power cycle phone when changing from 16-bit to 128-bit UUID to remove any local phone storage.
var myTiServiceUuid           = "48d60a60-f000-11e3-b42d-0002a5d5c51b";
var myTiTxCharacteristicUuid  = "6711";       // Tx from the bluetooth device profile, Rx for the phone app.
var myTiRxCharacteristicUuid  = "6722";       // Rx from our bluetooth device profile, Tx for the phone app.

// Microchip's transparent protocol IDs.
var myMcServiceUuid           = "49535343-fe7d-4ae5-8fa9-9fafd205e455";
var myMcTxCharacteristicUuid  = "49535343-1e4d-4bd9-ba61-23c647249616";       // Tx from the bluetooth device profile, Rx for the phone app.
var myMcRxCharacteristicUuid  = "49535343-8841-43f4-a8d4-ecbe34729bb3";       // Rx from our bluetooth device profile, Tx for the phone app.


// Argh, assume we be talking to a TI part...
var bridgeServiceUuid           = myTiServiceUuid;              // "48d60a60-f000-11e3-b42d-0002a5d5c51b";
var bridgeTxCharacteristicUuid  = myTiTxCharacteristicUuid;     // "6711";       // Tx from the bluetooth device profile, Rx for the phone app.
var bridgeRxCharacteristicUuid  = myTiRxCharacteristicUuid;     // "6722";       // Rx from our bluetooth device profile, Tx for the phone app.


var scanTimer          = null;
var connectTimer       = null;
var reconnectTimer     = null;
var subscribeTimer     = null;
var bMaxRssiScanning   = false;
var maxRssi            = -200;
var maxRssiAddr        = null;
var bRefreshActive     = false;
var uBtAutoTryCount    = 0;
var bBtTryFavoriteMac  = false;
var bTryConnectCalled  = false;

var BluetoothCnxTimer = null;
var ShutDownBluetoothTimer = null;

var SCAN_RESULTS_SIZE = 62;     // advertisement data can be up to 31 bytes and scan results data can be up to 31 bytes.
var u8ScanResults     = new Uint8Array(SCAN_RESULTS_SIZE);


var isBluetoothSubscribed   = false;
var bDisconnectCalled       = false;

var u8TxBuff            = new Uint8Array(260);
var uTxBuffIdx          = 0;
var uTxMsgLen           = 0;


var getSnIdx            = 0;
var getSnState          = 0;
var firstFoundIdx       = 0;
var icdDeviceList       = []; 
var boardCfgList        = [];
var icdBtList           = [];       // List of ICD versions from BT chip advertisement.   0xAB: A: 4-bits type, B: Version
var skalBtMacAddrList   = [];       // List of Skal MAC addresses returned from Skal.  Added for IOS.
var babblingMacsList    = [];       // Comma separated list of MAC addresses to ignore.
const   BABBLING_MAC_ID = "BabblingMacList"; 

const BT_ICD_TYPE_SKAL  = 0x10;     // Top 4-bits used for type.
const BT_ICD_VER_2      = 0x02;     // Lower 4-bits used for version.
                                    // Ver 0x01: Normal ICD communication
                                    // Ver 0x02: Use debug protocol and the thunk layer.

var u8ThunkTx           = null;
var u8ThunkRx           = null;
var bRxThunkPending     = false;    // _SendTxThunkIn() / ReadRxThunkOut() and _GetDataBlock() / GetDataBlockDone(). 
var u8ThunkRxCount      = 0;        // Number of Rx:d bytes to generate an ICD Rx.
var u8ThunkRxCountTotal = 0;
var u8IcdRxCountTotal   = 0;


// Added for WaveTools...
var Module = new Object;
var guiDisableBtScanFlag    = false;
var bPrivacyViewed          = true;
var enableLocationPerDialog = false;  // will be TRUE if the device is iOS or Android >= 6.0 version
var guiDeviceFlag           = false;            // Flag:  true:  display device selection 
var guiFavoriteMacAddr      = null;             // Stores MAC address of favorite device.  Set when user presses "Connect".
var guiFavoriteIcd          = 0;
var guiFavoriteRssi         = -99;
var guiDeviceFlag           = false;            // Flag:  true:  display device selection 
var guiNumDevicesFound      = 0;                // Number of eligible BT CelFi devices.
var guiDeviceMacAddrList    = [];               // An array of device addresses to select. (Android: MAC, IOS: Mangled MAC)
var guiDeviceRssiList       = [];               // An array of associated BT RSSI values...
var guiDeviceSnList         = [];               // An array of Serial Numbers to display for user to select.
var guiDeviceTypeList       = [];               // An array of device types, "Antenna", "2BoxNu", "2BoxCu", "1Box", "Cable"  (Antenna for Skal)
var guiDeviceSubSnList      = [];               // An array of booster Serial Numbers associated with an antenna in guiDeviceSnList[] SN, index is one to one with guiDeviceSnList[].
var guiDeviceSubCnxList     = [];               // An array of "CNX" devices, index is on to one with guiDeviceSnList[].
var guiDeviceTempSubSnList  = [];               // An array of serial numvers associated with a specific Antenna SN.   This is re-populated with each call to ConnectDevice().
var guiAntennaGetBoosterListFlag = false;       // true when a delay should be displayed. 
var guiAntennaGotBoosterListFlag = false;       // true when guiDeviceTempSubSnList[] has been populated. 
var guiSerialNumber         = null;             // String based on the serial number.

var bSkalAntControlFlag          = false;       // Read AntennaControl reg to see if G32 type GO.  false: If value is 0xDEADBABE then not G32.
var deviceFoundUIFlag       = false;
var locationEnabled         = false;    // For IOS or Android >= 6, set to TRUE if location enabled after check.

// OpenSouthBoundIf...................................................................................
function OpenSouthBoundIf(bFirstTime)
{
    PrintLog(1, "BT: Starting bluetooth");

    // WAVEAPP-544: See if we have a cached MAC address for auto connect. (Wavetools no caching)
//    if( IsAnyDeviceRemembered() )
//    {
//        bBtTryFavoriteMac  = true;
//        guiFavoriteMacAddr = window.localStorage.getItem( "guiFavoriteMacAddr_ID" );
//        guiFavoriteIcd     = parseInt( window.localStorage.getItem( "guiFavoriteIcd_ID" ) );
//        guiFavoriteRssi    = parseInt( window.localStorage.getItem( "guiFavoriteRssi_ID" ) );
//    }

    
/*
jdo do not enable the thunker for MyWave 

    if( bFirstTime )
    {
        // Initialize the Thunk layer, i.e. ICD to debug
        var maxNumTxThunkBytes = 1024 * 1024; // NXTY_V2_MAX_MSG_SIZE;
        var maxNumRxThunkBytes = NXTY_V2_MAX_MSG_SIZE;
        u8ThunkTx = Module.AllocToThunkU8(maxNumTxThunkBytes);
        u8ThunkRx = Module.AllocToThunkU8(maxNumRxThunkBytes);
    }
*/    

/*    
    guiFavoriteMacAddr = window.localStorage.getItem( "guiFavoriteMacAddr_ID" );
    if( (guiFavoriteMacAddr != null) )
    {
        guiFavoriteIcd     = window.localStorage.getItem( "guiFavoriteIcd_ID" );
        guiFavoriteRssi    = window.localStorage.getItem( "guiFavoriteRssi_ID" );
        
        if( (guiFavoriteIcd != null) && (guiFavoriteRssi != null) )
        {
            bBtTryFavoriteMac = true;
            guiFavoriteIcd    = parseInt( window.localStorage.getItem( "guiFavoriteIcd_ID" ) );
            guiFavoriteRssi   = parseInt( window.localStorage.getItem( "guiFavoriteRssi_ID" ) );
        }
    }
*/
    
    var paramsObj = { "request": true,  "statusReceiver": true };
    bluetoothle.initialize(initializeSuccess, /*initializeError, */ paramsObj);  // error no longer used with plugin 3.3.0.
}


function initializeSuccess(obj)
{
  if (obj.status == "enabled")
  {
      // If we initialize successfully, start a loop to maintain a connection...
      PrintLog(1, "BT: Initialization successful, starting periodic bluetooth maintenance loop...");
      isSouthBoundIfEnabled = true;
      searchAnimationFlag = false;
      BluetoothLoop();
  }
  else
  {
      PrintLog(99, "BT: Unexpected initialize status: " + obj.status);
      
      if( obj.status == "disabled" )
      {
          CatchBluetoothDisabled();
      }
      
      
      Spinnerstop()
      showAlert( obj.status, "Bluetooth Error" );
  }

  isSouthBoundIfStarted = true;
}

// This function no longer necessary with plugin 3.3.0...
/*
function initializeError(obj)
{
  PrintLog(99, "BT: Initialize error: " + obj.error + " - " + obj.message);
  CatchBluetoothDisabled();
}
*/

//HandleBtDisabledConfirmation.......................................................................................
function HandleBtDisabledConfirmation(buttonIndex) 
{
    PrintLog(1, "BT: User pressed Try Again which called the handler --> HandleBtDisabledConfirmation(" + buttonIndex + ")"  );
    // buttonIndex = 0 if dialog dismissed, i.e. back button pressed.
    // buttonIndex = 1 if 'Ok'
    if( buttonIndex == 0 )
    {
        // If they dismiss, then give it to them again....
//        ShowConfirmPopUpMsg( 'KEY_BLUETOOTH_REQUIRED',               // title
//           "", // "This app requires Bluetooth to be enabled.<br>Please activate Bluetooth from your system settings.",    // message text written by handler
//           HandleBtDisabledConfirmation,      // callback to invoke with index of button pressed
//           ['Ok'] );
    }
    else if( (buttonIndex == 1) || (buttonIndex == 2) )
    {
        // Ok...
        if( BluetoothCnxTimer != null )
        {
            clearTimeout(BluetoothCnxTimer);
            BluetoothCnxTimer = null;   
        }
        OpenSouthBoundIf(false);     // Re open the interface
    }
}

// CatchBluetoothDisabled...................................................................................
// If some silly user disables bluetooth along the way then inform.
// Note that OS will catch at the start but this will catch if user disables bluetooth while running.
function CatchBluetoothDisabled()
{
    PrintLog(1, "BT: CatchBluetoothDisabled()" );
    isSouthBoundIfEnabled = false;
    isSouthBoundIfStarted = true;
    showAlert("BlueTooth", "This app requires Bluetooth to be enabled.<br>Please activate Bluetooth from your system settings and restart app.");
//    ShowConfirmPopUpMsg( 'KEY_BLUETOOTH_REQUIRED',               // title
//            "This app requires Bluetooth to be enabled.<br>Please activate Bluetooth from your system settings.",    // message text written by handler, this text written to log.
//            HandleBtDisabledConfirmation,      // callback to invoke with index of button pressed
//            ['Ok'] );
}

// BluetoothLoop...................................................................................
// Check every 10 seconds if not connected and subscribed and every 15 seconds if already connected...
function BluetoothLoop()
{
    if( bPhoneInBackground )
    {
        // Phone in background, run without BT...
        // Note that this loop is stopped if a BT device has already connected but
        // if trying to connect then the disconnect logic does not stop this loop.
        BluetoothCnxTimer = setTimeout(BluetoothLoop, 5000);
    }
    else
    {
        // Phone in foreground so act normally...
        var paramsObj = {"address":btAddr};
        bluetoothle.isConnected( isConnectedCallback, isConnectedCallback, paramsObj );
    }
}

function isConnectedCallback(obj)
{
    if(obj.isConnected)
    {
        PrintLog(1, "BT: bluetooth cnx callback: Cnx" );
        uNoBtCount = 0;
        UpdateBluetoothIcon( true );

        // Check again in 10 seconds since we are connected...
        BluetoothCnxTimer = setTimeout(BluetoothLoop, 10000);

        if( isBluetoothSubscribed == false )
        {
          // Run Discover and if successful then subscribe to the Tx of our device
          PrintLog(1, "BT: bluetooth cnx callback: Cnx but not subscribed yet so retry..." );
          DiscoverBluetoothDevice();
        }
    }
    else
    {
        PrintLog(1, "BT: bluetooth cnx callback: Not Cnx" );
        UpdateBluetoothIcon( false );

        // Check again in 5 seconds...
		if( bPrivacyViewed == true )
		{
	        BluetoothCnxTimer = setTimeout(BluetoothLoop, 5000);
	        
	        if( guiDisableBtScanFlag == false )
	        {
	            PrintLog(1, "BT: Privacy Policy accepted, check to see if scan allowed..." );
	        
	            if( window.device.platform == androidPlatform  ) 
	            {
	                // Android version >= 6 must have Location services on for Bluetooth scan to work...
	                if( parseInt(window.device.version, 10) < 6)
	                {
	                    // Before Android 6, there is no way to determine if location services are on or not so just assume on.
                        PrintLog(1, "BT: Android version < 6 so location services not necessary.  Go ahead and start BT scan." );
                        locationEnabled = true;     // Set so we know it is ok to call geolocation which will timeout if location services not enabled.
                        StartBluetoothScan();
	                }
	                else
	                {
	                    PrintLog(1, "BT: Android version >= 6 so location services are required." );
	        
	                    bluetoothle.isLocationEnabled(isLocationEnabledSuccessAndroid, isLocationEnabledErrorAndroid);

	                    function isLocationEnabledSuccessAndroid(status)
	                    {
	                        if( status.isLocationEnabled == true )
	                        {
    	                        PrintLog(1, "BT: Location services enabled." );
                                locationEnabled = true;     // Set so we know it is ok to call geolocation.

    	                        bluetoothle.hasPermission(function(obj) 
    	                        {
    	                            if (obj.hasPermission) 
    	                            {
    	                                PrintLog(1, "BT: Permission to use location granted." );
    	                                StartBluetoothScan();
    	                            } 
    	                            else 
    	                            {
                                        PrintLog(1, "BT: Permission to use location not granted yet." );
    	                                guiDisableBtScanFlag = true;    // Disable the start of BT scanning since we must throw dialog and then reset...
//    	                                util.preLocationMessageAndroid(true);  // true to indicate location enabled but permission not granted yet.
                                      preLocationMessageAndroid(true);  // true to indicate location enabled but permission not granted yet.
    	                            }
    	                        });
	                        }
	                        else
	                        {
	                            PrintLog(1, "BT: Location services disabled." );
	                            locationEnabled = false;
	                            guiDisableBtScanFlag = true;    // Disable the start of BT scanning since we must throw dialog and then reset...
//	                            util.preLocationMessageAndroid(false);  // false to indicate location not enabled yet.
	                            CatchBluetoothDisabled();  // Should not get here since should have already been caught.
	                        }
	                    }

                        function isLocationEnabledErrorAndroid()
	                    {
                            PrintLog(1, "BT: Location services not enabled.  Err callback." );
                            locationEnabled = false;
                            guiDisableBtScanFlag = true;    // Disable the start of BT scanning since we must throw dialog and then reset...
//                            util.preLocationMessageAndroid(false);  // false to indicate location not enabled yet.
                            CatchBluetoothDisabled();  // Should not get here since should have already been caught.
	                    }
	                }
    
                }  // android platform
   

	        }
	        else
	        {
                PrintLog(1, "BT: Do not call StartBluetoothScan().  Var guiDisableBtScanFlag=" + guiDisableBtScanFlag );
	        }
                
/*                
                // Waveapp-760: General BT catch.  Inform after 30 seconds of no BT.
                if( (bMonitorBt == true) )
                {
                    uNoBtCount++;
    	            if( uNoBtCount > 3 )
    	            {
    	                showAlert("WaveTools", "Bluetooth connection lost.");
//    	                ShowAlertPopUpMsg(GetLangString("BluetoothCnxLost"),  GetLangString("UnableToSyncError99") );
    	                uNoBtCount = 0;
    	            }
                }
*/
	        
		}
		else
		{
	        BluetoothCnxTimer = setTimeout(BluetoothLoop, 2000);   // Come back in 2 seconds if Privacy not viewed yet.
		}
    }
}


// Android specific-----------------------------------------------------
function HandlePreLocationConfirmation(buttonIndex) 
{
 // buttonIndex = 0 if dialog dismissed, i.e. back button pressed.
 // buttonIndex = 1 if 'Ok'
 if( (buttonIndex == 0) || (buttonIndex == 1) )
 {
     // Ok...
     checkLocationPermissionAndroid();
 }
}

function restartApp() 
{
    location.reload();
}

function HandleLocationServicesRequiredConfirmation()
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

// message for user before asking for location services
function preLocationMessageAndroid(bLocationEnabled) // ignore the bLocationEnabled argument
{
    PrintLog(1, "preLocationMessageAndroid(" + bLocationEnabled + ")" );
    
    navigator.notification.confirm(
            GetLangString('LocationServicesText'),    // message
            HandlePreLocationConfirmation,  // callback to invoke with index of button pressed
            GetLangString('LocationServices'),       // title
            ['Ok'] );                       // buttonLabels
}

function checkLocationPermissionAndroid() 
{
    PrintLog(1, "checkLocationPermissionAndroid()");
    
    bluetoothle.hasPermission(function(obj) 
    {
        if (obj.hasPermission) {
            //Already has permissions
            // Re-enable the check and now both location services and permissions shouold pass so bluetooth should start scanning.
            guiDisableBtScanFlag = false;               
            PrintLog(1, "checkLocationPermissionAndroid() - already has permission.");
            return;
        }

        PrintLog(1, "checkLocationPermissionAndroid() - phone may be automatically sent to the background to show system permission popup.");
        bluetoothle.requestPermission(function(obj) 
        {
            if (obj.requestPermission) 
            {
                //Permission granted
                // Re-enable the check and now both location services and permissions shouold pass so bluetooth should start scanning.
                guiDisableBtScanFlag = false;               
                PrintLog(1, "checkLocationPermissionAndroid() - user just granted permission.");
                return;
            }

            // Permission denied, show another message?
            PrintLog(1, "checkLocationPermissionAndroid() - user just denied permission.");
//            util.displayLocationServiceRequiredAndroid();
            displayLocationServiceRequiredAndroid();  
        });
    });
}


function displayLocationServiceRequiredAndroid()
{
    PrintLog(1, "displayLocationServiceRequiredAndroid()" );
    
    navigator.notification.confirm(
            GetLangString('LocationServicesRequiredText'),    // message
            HandleLocationServicesRequiredConfirmation,  // callback to invoke with index of button pressed
            GetLangString('LocationServicesRequired'),       // title
            ['Try Again'] );                       // buttonLabels

}



// StartScan.....................................................................................
function StartBluetoothScan()
{
//    checkPermission(); 
    PrintLog(1, "BT: StartBluetoothScan()...");
    
    // WAVEAPP-544: See if we have a cached MAC address for auto connect.
    if( bBtTryFavoriteMac )
    {
        PrintLog(1, "BT: Try Favorite MAC:" + guiFavoriteMacAddr);
        guiDeviceMacAddrList = [];
        guiDeviceRssiList    = [];
        icdBtList            = [];

        guiDeviceMacAddrList.push(guiFavoriteMacAddr);
        guiDeviceRssiList.push(guiFavoriteRssi);
        icdBtList.push(guiFavoriteIcd);
        
        guiDeviceSnList.push("None");
        guiDeviceTypeList.push("None");
        guiDeviceSubSnList.push("None");
        guiDeviceSubCnxList.push("None");
        icdDeviceList.push(0);
        boardCfgList.push(0);
        skalBtMacAddrList.push(0);
        
        
        bBtTryFavoriteMac = false;      // Only try one time...
//        deviceFoundUIFlag = true;       // Keep the popup, "Can't find a booster" from showing up after 2 minutes.
        tryConnect();
    }
    else
    {
        PrintLog(1, "BT: Starting scan for Cel-Fi devices.");
        if( (window.device.platform == androidPlatform) && (parseFloat(window.device.version) < 5.0) )
        {    
            var paramsObj = {
//          "services":[myAdvertisingUuid],                         // Some Android 4.4.x versions had issues filtering...
              allowDuplicates: true,
              scanMode: bluetoothle.SCAN_MODE_LOW_LATENCY,
              callbackType: bluetoothle.CALLBACK_TYPE_ALL_MATCHES,
              matchNum: bluetoothle.MATCH_NUM_MAX_ADVERTISEMENT,
              matchMode: bluetoothle.MATCH_MODE_AGGRESSIVE,
            };
        }
        else
        {
            var paramsObj = {
              "services":[myAdvertisingUuid],
              allowDuplicates: false, // true,
              scanMode: bluetoothle.SCAN_MODE_LOW_LATENCY,
              callbackType: bluetoothle.CALLBACK_TYPE_ALL_MATCHES,
              matchNum: bluetoothle.MATCH_NUM_MAX_ADVERTISEMENT,
              matchMode: bluetoothle.MATCH_MODE_AGGRESSIVE,
            };
                
        }
        
    
        bMaxRssiScanning = true;
        connectTimer     = null;
//    setTimeout(scanMaxRssiTimeout, 1000 );
        bluetoothle.startScan(startScanSuccess, startScanError, paramsObj);
    }
}

function scanMaxRssiTimeout()
{
    bMaxRssiScanning = false;
    PrintLog(1, "BT: Set bMaxRssiScanning to false.  bMaxRssiScanning="  + bMaxRssiScanning );
}

function checkPermission() {
  bluetoothle.hasPermission(function(obj) {
    if (obj.hasPermission) {
      //Already has permissions
      return;
    }

    //TODO Permission not granted, show permissions explanantion popup

    bluetoothle.requestPermission(function(obj) {
      if (obj.requestPermission) {
        //Permission granted
        return;
      }

      //TODO Permission denied, show another message?
      PrintLog(99, "BT: Permission denied.")
    });
  });
}


function startScanSuccess(obj)
{
  var i;
  var uIcd = 0;
  var tempSn = "None";
  var tempDeviceIcd = 0;
  var snOffset = 0;
  
  if (obj.status == "scanResult")
  {
    var scanStr = JSON.stringify(obj);
    PrintLog(10, "BT: Scan result: " + scanStr );


    //if( scanStr.search("advertisement") != -1 )
    if (obj.advertisement)
    {
        var bytes = null;
        if (window.device.platform == iOSPlatform) {
          bytes = bluetoothle.encodedStringToBytes(obj.advertisement.manufacturerData)
        } else {
          bytes = bluetoothle.encodedStringToBytes(obj.advertisement)
        }
        var bDeviceFound = false;

        // Save the Scan Results data...
        if( bytes.length != 0 )
        {
            for( i = 0; i < SCAN_RESULTS_SIZE; i++ )
            {
                if( i < bytes.length )
                {
                    u8ScanResults[i] = bytes[i];
                }
            }
        }

        var outText = u8ScanResults[0].toString(16);    // Convert to hex output...
        for( i = 1; i < u8ScanResults.length; i++ )
        {
            outText = outText + " " + u8ScanResults[i].toString(16);
        }
        PrintLog(10,  "BT: Msg Advertise: " + outText );


        // Neither Android nor IOS filters based on the 128-bit UUID so we have to determine if
        // this device is ours.  (jdo:  This was true early on but now both IOS and Android filter based on 128 bit UUID.)
        // Android:  Compare 128-bit UUID.
        // IOS:      Compare name since 128-bit UUID not provided to app.
        if( window.device.platform == iOSPlatform )
        {

            // The returned bytes for IOS are...                                IOS returns only manufacturer specific data...
            //                                                                  [0]
            // "2 1 6 11 6 1b c5 d5 a5 02 00 2d b4 e3 11 00 F0 60 0A D6 48 07 ff 0 1 xx yy 25 29 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0
            // "2 1 6 11 6 1b c5 d5 a5 02 00 2d b4 e3 11 00 F0 60 0A D6 48 09 ff 0 2 <6-byte SN>                                 Microchip with SN
            //  |    advertise data                                                            | |             scan results                    |
            //                                                                     ^ ^  ^  ^  ^
            //                                                                     | SW Ver|  Rx Handle
            //                                                                     |       Tx Handle
            //                                                                    ICD


            if( (obj.name == "Nextivity Bridge") || (obj.name == "CelFi 2451")  || (obj.name == "CelFi 2640") || (obj.name == "CelFi 1871"))
            {
                PrintLog(10, "BT: IOS: Cel-Fi device found based on name: " + obj.name );
                bDeviceFound = true;
            }
            else
            {
                // The phone has not pulled the name so match as much data as possible.
                if( (u8ScanResults[0] == 0x00) && (u8ScanResults[4] == 0x25) && (u8ScanResults[5] == 0x29) )
                {
                    PrintLog(10, "BT: IOS: Cel-Fi device found based on advertised data: [4]=0x25 and [5]=0x29" );
                    bDeviceFound = true;
                }
            }
        }
        else
        {
            // Non IOS: Android and Win.
            var nxty128Uuid = new Uint8Array([0x1b, 0xc5, 0xd5, 0xa5, 0x02, 0x00, 0x2d, 0xb4, 0xe3, 0x11, 0x00, 0xF0, 0x60, 0x0A, 0xD6, 0x48]);

            // The returned bytes are...
            // [0]         [5]                                                    [24]                       [28]
            // "2 1 6 11 6 1b c5 d5 a5 02 00 2d b4 e3 11 00 F0 60 0A D6 48 07 ff 0 1 xx yy 25 29 7 9 43 65 6c 2d 46 69 3 2 34 67 5 ff 0 1 xx yy
            //  |    advertise data                                                            | |             scan results                   |
            //                                                                     ^ ^  ^  ^  ^                                         ^ ^  ^
            //                                                                     | SW Ver|  Rx Handle                                 | |  |
            //                                                                     |       Tx Handle                                    | SW Version
            //                                                                    ICD                                                  ICD

            if(u8ScanResults[0] == 0x02)
            {
                // Non-microchip
                // See if we can match the 128-bit, 16 byte, UUID.  128-bit UUID starts at offset [5].
                for( i = 0; i < nxty128Uuid.length; i++ )
                {
                    if( u8ScanResults[i+5] != nxty128Uuid[i] )
                    {
                        break;
                    }
                }
            }
            else
            {
                // Microchip packet using built in advertising packet...
                // The returned bytes are...
                // [0]    [2]                                                      [21]            
                // "11 07 1b c5 d5 a5 02 00 2d b4 e3 11 00 F0 60 0A D6 48 07 ff 00 02 xx yy 25 29   02 01 06   7 9 43 65 6c 2d 46 69 3 2 34 67 5 ff 0 1 xx yy  ... built in starts with 0x11
                // "02 01 06 11 06 1b c5 d5 a5 02 00 2d b4 e3 11 00 F0 60 0A D6 48 09 ff 00 02 <6-byte SN>                                                     ... SN added by embedded code.
                
                // See if we can match the 128-bit, 16 byte, UUID.  128-bit UUID starts at offset [2].
                for( i = 0; i < nxty128Uuid.length; i++ )
                {
                    if( u8ScanResults[i+2] != nxty128Uuid[i] )
                    {
                        break;
                    }
                }
            }
                


            if( i == nxty128Uuid.length )
            {
                PrintLog(10, "BT: Android: Cel-Fi device found based on 128-bit UUID" );
                bDeviceFound = true;
            }
            else if( (obj.name == "Nextivity Bridge") || (obj.name == "CelFi 2451")  || (obj.name == "CelFi 2640") || (obj.name == "CelFi 1871"))
            {
                PrintLog(10, "BT: Android: Cel-Fi device found based on name: " + obj.name );
                bDeviceFound = true;
            }
        }

        //Clearing the device search timeout, based on bDeviceFound flag
        if(bDeviceFound){
          deviceFoundUIFlag = true;
        }

        // See if we need to continue scanning to look for max RSSI, only if we have not connected before...
        if( bDeviceFound && (myLastBtAddress == null) && (scanTimer != null) )
        {
            if( bMaxRssiScanning )
            {
                PrintLog(10, "BT: Max RSSI scanning, addr: " + obj.address + " RSSI: " + obj.rssi + " max RSSI so far:" + maxRssi );

                if( obj.rssi > maxRssi )
                {
                    maxRssi      = obj.rssi;
                    maxRssiAddr  = obj.address
                    PrintLog(10, "BT: This Cel-Fi address: " + maxRssiAddr + " has max RSSI so far: " + maxRssi );
                }

                if( window.device.platform == iOSPlatform )
                {
                    uIcd         = u8ScanResults[1];
                    swVerBtScan  = U8ToHexText(u8ScanResults[2]) + "." + U8ToHexText(u8ScanResults[3]);
                    snOffset     = 2;
                }
                else
                {
                    if( u8ScanResults[0] == 0x11 )
                    {
                        // Microchip offsets for Android built in advertising packet...
                        uIcd        = u8ScanResults[21];
                        swVerBtScan = U8ToHexText(u8ScanResults[22]) + "." + U8ToHexText(u8ScanResults[23]);
                    }
                    else
                    {
                        uIcd        = u8ScanResults[24];
                        swVerBtScan = U8ToHexText(u8ScanResults[25]) + "." + U8ToHexText(u8ScanResults[26]);
                        snOffset     = 25;
                    }
                }

                // See if this device includes the SN.
                if( (uIcd & BT_ICD_VER_2) == BT_ICD_VER_2)
                {
                    tempSn = "";
                    for( i = 0; i < 6; i++ )
                    {
                        tempSn += U8ToHexText(u8ScanResults[snOffset+i]);
                    }
                    PrintLog(1, "BT: Device SN found in Advertising packet.  SN=" + tempSn );
                    tempSn = "SN:" + tempSn;
                    tempDeviceIcd = V4_ICD;
                }

                // Fill the BT address list...
                for( i = 0; i < (guiDeviceMacAddrList.length + 1); i++ )
                {
                    if(typeof guiDeviceMacAddrList[i] === 'undefined')
                    {
                        guiDeviceMacAddrList.push(obj.address);
                        guiDeviceRssiList.push(obj.rssi);
                        icdBtList.push(uIcd);
                        
                        // Fill remaining lists...
                        guiDeviceSnList.push(tempSn);
                        guiDeviceTypeList.push("None");
                        guiDeviceSubSnList.push("None");
                        guiDeviceSubCnxList.push("None");
                        icdDeviceList.push(tempDeviceIcd);
                        boardCfgList.push(0);
                        skalBtMacAddrList.push(0);

                        
                        PrintLog(1, "BT: Add to list: " + obj.address + " RSSI: " + obj.rssi + " max RSSI so far:" + maxRssi);
                        break;
                    }
                    else if( guiDeviceMacAddrList[i] == obj.address )
                    {
                        guiDeviceRssiList[i] = obj.rssi;
                        break;
                    }
                }


                // If we are still scanning for the max then do not proceed below...
                bDeviceFound = false;
            }
        }


        if( bDeviceFound )
        {
          // If we have connected before then we must match last address...
            if( myLastBtAddress != null )
            {
                if( myLastBtAddress != obj.address )
                {
                    PrintLog(1, "BT: This Cel-Fi address: " + obj.address + " does not match the last connected Cel-Fi address: " + myLastBtAddress + ".  Restart app to reconnect to a different Cel-Fi." );
                    bDeviceFound = false;
                }
                else
                {
                    if(connectTimer == null)
                    {
                        PrintLog(1, "BT: This Cel-Fi address: " + obj.address + " matches the last connected Cel-Fi address: " + myLastBtAddress + ".  Reconnecting..." );
                        bluetoothle.stopScan(stopScanSuccess, stopScanError);
                        clearScanTimeout();
                        ConnectBluetoothDevice(myLastBtAddress);
                    }
                }
            }
        }

        if( bDeviceFound && (scanTimer != null) && (connectTimer == null) && (guiDeviceFlag == false) )
        {
            clearScanTimeout();
            bluetoothle.stopScan(stopScanSuccess, stopScanError);

            // Store the address on the phone...not used
//            window.localStorage.setItem(addressKey, obj.address);

            tryConnect();
        }

    }  // if we have found "advertisement"


  }
  else if (obj.status == "scanStarted")
  {
    PrintLog(1, "BT: Scan was started successfully, stopping in 4 sec.");
    scanTimer = setTimeout(scanTimeout, 4000);
  }
  else
  {
    PrintLog(99, "BT: Unexpected start scan status: " + obj.status);
  }
}



function startScanError(obj)
{
  PrintLog(99, "BT: Start scan error: " + obj.error + " - " + obj.message);
}

function scanTimeout()
{
  PrintLog(1, "BT: Scanning time out, stopping");
  bluetoothle.stopScan(stopScanSuccess, stopScanError);
  scanTimer = null;
  
  if( (connectTimer == null) && (guiDeviceFlag == false) && (guiDeviceMacAddrList.length != 0) )
  {
    tryConnect();
  }

}

function clearScanTimeout()
{
  PrintLog(1, "BT: Clearing scanning timeout");
  if (scanTimer != null)
  {
    clearTimeout(scanTimer);
    scanTimer = null;
  }
}

function stopScanSuccess(obj)
{
  if (obj.status == "scanStopped")
  {
    PrintLog(1, "BT: Scan was stopped successfully");
  }
  else
  {
    PrintLog(1, "BT: Unexpected stop scan status: " + obj.status);
  }
}

function stopScanError(obj)
{
  PrintLog(99, "BT: Stop scan error: " + obj.error + " - " + obj.message);
}


//UpdateBluetoothIcon....................................................................................
function UpdateBluetoothIcon(cnx)
{
 if(cnx)
 {
    
     if( isSouthBoundIfCnx == false )
     {
         PrintLog(1, "BT: UpdateBluetoothIcon(): Set isSouthBoundIfCnx to true" );
     }
     
     if( isSouthBoundIfListDone )
     {
         if( document.getElementById("bt_icon_id").innerHTML != szSbIfIconOn )
         {
             document.getElementById("bt_icon_id").innerHTML = szSbIfIconOn;
         }
         
         if(bWaveTest)
         {
             if( document.getElementById("bt_main_id").innerHTML != szSbIfMainOn )
             {
                 document.getElementById("bt_main_id").innerHTML = szSbIfMainOn;
             }
         }
         
     }

     var cnxIdx = guiDeviceMacAddrList.indexOf(btAddr);

/*
jdo do not enable the thunker...
     if( (icdBtList[cnxIdx] & BT_ICD_VER_2) == BT_ICD_VER_2)
     {
         PrintLog(1, "BT: Set bBtIcdVer2 and bUseThunkLayer to true: Tech data will use ID-Val pairs.  No PIC-ICD status message." );
         
         bBtIcdVer2        = true;
         bUseIdValTechData = true;
         bUseThunkLayer    = true;
         bRxThunkPending   = false;
         Module._ReorderReset(); // reset the thunk counters.

     }
     else
*/
     
     {
         PrintLog(1, "BT: Set bBtIcdVer2 and bUseThunkLayer to false: Tech data will use C-struct." );
         bBtIcdVer2        = false;
         bUseIdValTechData = false;
         bUseThunkLayer    = false;
     }
     
     
     guiSerialNumber = guiDeviceSnList[cnxIdx];  
     UpdateStatusLine( guiSerialNumber );

     
     isSouthBoundIfCnx     = true;
 }
 else
 {
     if( isSouthBoundIfCnx == true )
     {
         PrintLog(1, "BT: UpdateBluetoothIcon(): Set isSouthBoundIfCnx to false" );
     }
     
     if( document.getElementById("bt_icon_id").innerHTML != szSbIfIconOff )
     {
         document.getElementById("bt_icon_id").innerHTML = szSbIfIconOff;
     }

     if(bWaveTest)
     {
         if( document.getElementById("bt_main_id").innerHTML != szSbIfMainOff )
         {
             document.getElementById("bt_main_id").innerHTML = szSbIfMainOff;
         }
     }
     
     isSouthBoundIfCnx     = false;
     isBluetoothSubscribed = false;
     u8ScanResults[0]      = 0;
     bBtIcdVer2   = false;
     
     UpdateStatusLine( "SN: " );

 }
}


// ConnectBluetoothDevice...................................................................................
// Per plugin: Connect to a Bluetooth LE device. The Phonegap app should use a timer to limit the
// connecting time in case connecting is never successful. Once a device is connected, it may
// disconnect without user intervention. The original connection callback will be called again
// and receive an object with status => disconnected. To reconnect to the device, use the reconnect method.
// Before connecting to a new device, the current device must be disconnected and closed.
// If a timeout occurs, the connection attempt should be canceled using disconnect().
function ConnectBluetoothDevice(address)
{
    if( address != null )
    {
        PrintLog(1, "BT: ConnectBluetoothDevice(" + address + ") (Set bBtTryingToCnx=true)" );
      
        bBtTryingToCnx = true;
    
        var paramsObj = {"address":address};
        bluetoothle.connect(connectSuccess, connectError, paramsObj);
        btAddr        = address;
        connectTimer  = setTimeout(connectTimeout, 4000);
    }
    else
    {
        PrintLog(1, "BT: ConnectBluetoothDevice(address=null) not connected" );
    }
}

function connectSuccess(obj)
{
  if (obj.status == "connected")
  {
    PrintLog(1, "BT: Connected to : " + obj.name + " - " + obj.address);

    // Save the address...
    myLastBtAddress = obj.address;

    // Update the bluetooth icon...
//    UpdateBluetoothIcon( true );

    clearConnectTimeout();

    // Must run Discover before subscribing...
    DiscoverBluetoothDevice();
    
  }
  else
  {
    PrintLog(99, "BT: Unexpected connect status: " + obj.status);

    if( obj.status == "disconnected" )
    {
        CloseBluetoothDevice();
        maxRssiAddr = null;
//        DisconnectBluetoothDevice();        // Disconnect and close
    }
    clearConnectTimeout();
  }
}

function connectError(obj)
{
  PrintLog(99, "BT: Connect error: " + obj.error + " - " + obj.message);
  clearConnectTimeout();
  CloseBluetoothDevice();
}

function connectTimeout()
{
  PrintLog(1, "BT: Connection timed out");
  DisconnectBluetoothDevice();
}

function clearConnectTimeout()
{

  if (connectTimer != null)
  {
    PrintLog(1, "BT: Clearing connect timeout");
    clearTimeout(connectTimer);
  }
}



// DisconnectBluetoothDevice...................................................................................
function DisconnectBluetoothDevice()
{
    PrintLog(1, "BT: DisconnectBluetoothDevice(" + btAddr + ") (disconnect and close)" );
    bDisconnectCalled = true;

    var paramsObj = {"address":btAddr};
    bluetoothle.disconnect(disconnectSuccess, disconnectError, paramsObj);
}

function disconnectSuccess(obj)
{
    if (obj.status == "disconnected")
    {
        PrintLog(1, "BT: Disconnect device success");

        // Update the bluetooth icon...
        UpdateBluetoothIcon( false );

        CloseBluetoothDevice();
    }
    else
    {
      PrintLog(99, "BT: Unexpected disconnect status: " + obj.status);
    }
}

function disconnectError(obj)
{
  PrintLog(99, "BT: Disconnect error: " + obj.error + " - " + obj.message);
}


// CloseBluetoothDevice...................................................................................
function CloseBluetoothDevice()
{

    PrintLog(1, "BT: CloseBluetoothDevice()");

    // First check to see if disconnected before closing...
    var paramsObj = {"address":btAddr};
    bluetoothle.isConnected(isConnectedSuccess, isConnectedSuccess, paramsObj);
}

function isConnectedSuccess(obj)
{
    if (obj.isConnected)
    {
        DisconnectBluetoothDevice();    // Disconnect and close
    }
    else
    {
        var paramsObj = {"address":btAddr};
        bluetoothle.close(closeSuccess, closeError, paramsObj);
    }

}

function closeSuccess(obj)
{
    if (obj.status == "closed")
    {
        PrintLog(1, "BT: Closed device (bBtTryingToCnx=false)");
        bBtTryingToCnx = false;

        if( bRefreshActive )
        {
            ConnectBluetoothDevice(myLastBtAddress);
            bRefreshActive = false;
        }

        UpdateBluetoothIcon( false );
    }
    else
    {
        PrintLog(99, "BT: Unexpected close status: " + obj.status);
    }
}

function closeError(obj)
{
    PrintLog(99, "BT: Close error: " + obj.error + " - " + obj.message);
    bRefreshActive = false;
}




// DiscoverBluetoothDevice........................................................................
function DiscoverBluetoothDevice()
{
    if( window.device.platform == iOSPlatform )
    {
        PrintLog(1, "BT:  IOS platform.  Begin search for bridge service");
//        var paramsObj = {"address":btAddr, "services":[bridgeServiceUuid]};
        var paramsObj = {"address":btAddr, "services":[myTiServiceUuid,myMcServiceUuid]};
        bluetoothle.services(servicesIosSuccess, servicesIosError, paramsObj);
    }
    else if( window.device.platform == androidPlatform )
    {
        var paramsObj = {"address":btAddr};
        PrintLog(1, "BT:  Android platform.  Beginning discovery");
        bluetoothle.discover(discoverSuccess, discoverError, paramsObj);
    }
}



// IOS only ...................................................................................................
function servicesIosSuccess(obj)
{
//    if( obj.status == "discoveredServices" )          // v1.0.6
    if( obj.status == "services" )                      // v2.0.0
    {
        // TI product looks like: BT: IOS Service discovered: {"status":"services","name":"Nextivity Bridge","services":["48D60A60-F000-11E3-B42D-0002A5D5C51B"],"address":"9190C10E-3C56-4BA5-87A7-D682B2C87B32"}
        // MC product looks like: BT: IOS Service discovered: {"status":"services","name":"IS1871","services":[],"address":"055D04DE-FDB8-4CDF-9EC0-3E2DD1515C7E"}


        
        PrintLog(1, "BT: IOS Service discovered: " + JSON.stringify(obj));
        var services = obj.services;
        
        // try to match service first, if no services listed the try name...
        if( services.length )
        {
            for( var i = 0; i < services.length; i++ )
            {
                var service = services[i];
    
                PrintLog(1, "BT: IOS service=" + service );
                
                if( service.toUpperCase() == myTiServiceUuid.toUpperCase() )    // "48d60a60-f000-11e3-b42d-0002a5d5c51b"
                {
                    bridgeServiceUuid           = myTiServiceUuid;              // "48d60a60-f000-11e3-b42d-0002a5d5c51b";
                    bridgeTxCharacteristicUuid  = myTiTxCharacteristicUuid;     // "6711";       // Tx from the bluetooth device profile, Rx for the phone app.
                    bridgeRxCharacteristicUuid  = myTiRxCharacteristicUuid;     // "6722";       // Rx from our bluetooth device profile, Tx for the phone app.
    
                    PrintLog(1, "BT:  IOS platform (TI chip found).  Finding bridge characteristics...");
                    var paramsObj = {"address":btAddr, "service":bridgeServiceUuid, "characteristics":[bridgeTxCharacteristicUuid, bridgeRxCharacteristicUuid]};
                    bluetoothle.characteristics(characteristicsIosSuccess, characteristicsIosError, paramsObj);
                    return;
                }
                else if( service.toUpperCase() == myMcServiceUuid.toUpperCase() )    // "49535343-fe7d-4ae5-8fa9-9fafd205e455"
                {
                    bridgeServiceUuid           = myMcServiceUuid;
                    bridgeTxCharacteristicUuid  = myMcTxCharacteristicUuid;
                    bridgeRxCharacteristicUuid  = myMcRxCharacteristicUuid;
    
                    PrintLog(1, "BT:  IOS platform (Microchip found).  Finding bridge characteristics...");
                    var paramsObj = {"address":btAddr, "service":bridgeServiceUuid, "characteristics":[bridgeTxCharacteristicUuid, bridgeRxCharacteristicUuid]};
                    bluetoothle.characteristics(characteristicsIosSuccess, characteristicsIosError, paramsObj);
                    return;
                }
                
            }
        }
        else
        {
            PrintLog(1, "BT: IOS name=" + obj.name );
            
            if( obj.name == "Nextivity Bridge" )
            {
                bridgeServiceUuid           = myTiServiceUuid;              // "48d60a60-f000-11e3-b42d-0002a5d5c51b";
                bridgeTxCharacteristicUuid  = myTiTxCharacteristicUuid;     // "6711";       // Tx from the bluetooth device profile, Rx for the phone app.
                bridgeRxCharacteristicUuid  = myTiRxCharacteristicUuid;     // "6722";       // Rx from our bluetooth device profile, Tx for the phone app.

                PrintLog(1, "BT:  IOS platform (TI chip found).  Finding bridge characteristics...");
                var paramsObj = {"address":btAddr, "service":bridgeServiceUuid, "characteristics":[bridgeTxCharacteristicUuid, bridgeRxCharacteristicUuid]};
                bluetoothle.characteristics(characteristicsIosSuccess, characteristicsIosError, paramsObj);
                return;
            }
            else if( obj.name == "IS1871" ) 
            {
                bridgeServiceUuid           = myMcServiceUuid;
                bridgeTxCharacteristicUuid  = myMcTxCharacteristicUuid;
                bridgeRxCharacteristicUuid  = myMcRxCharacteristicUuid;

                PrintLog(1, "BT:  IOS platform (Microchip found).  Finding bridge characteristics...");
                var paramsObj = {"address":btAddr, "service":bridgeServiceUuid, "characteristics":[bridgeTxCharacteristicUuid, bridgeRxCharacteristicUuid]};
                bluetoothle.characteristics(characteristicsIosSuccess, characteristicsIosError, paramsObj);
                return;
            }
        }

        PrintLog(99, "Bridge service not found");
    }
    else
    {
        PrintLog(99, "Unexpected services bridge status: " + JSON.stringify(obj));
    }

    DisconnectBluetoothDevice();
}

function servicesIosError(obj)
{
    PrintLog(99, "Services bridge error: " + obj.error + " - " + obj.message);
    DisconnectBluetoothDevice();
}



function characteristicsIosSuccess(obj)
{

//    if( obj.status == "discoveredCharacteristics" )       // v1.0.6
    if( obj.status == "characteristics" )                   // v2.0.0
    {
        PrintLog(1, "BT: IOS Characteristics discovered: " + JSON.stringify(obj));
        var characteristics = obj.characteristics;
        for( var i = 0; i < characteristics.length; i++ )
        {
            var characteristicUuid = characteristics[i].uuid;

            if( characteristicUuid.toUpperCase() == bridgeRxCharacteristicUuid.toUpperCase() )
            {
                var paramsObj = {"address":btAddr, "service":bridgeServiceUuid, "characteristic":bridgeRxCharacteristicUuid};
                bluetoothle.descriptors(descriptorsIosRxSuccess, descriptorsIosRxError, paramsObj);
                return;
            }

        }
    }
    else
    {
        PrintLog(99, "Unexpected characteristics bridge status: " + obj.status);
    }

    PrintLog(99, "BT: IOS No Rx Characteristic found: " + JSON.stringify(obj));
    DisconnectBluetoothDevice();
}

function characteristicsIosError(obj)
{
    PrintLog(99, "Characteristics bridge error: " + obj.error + " - " + obj.message);
    DisconnectBluetoothDevice();
}


function descriptorsIosRxSuccess(obj)
{
//    if (obj.status == "discoveredDescriptors")    // v1.0.6
    if (obj.status == "descriptors")                // v2.0.0
    {
        PrintLog(1, "BT: Rx Discovery completed.  Name: " + obj.name + " add: " + obj.address + "  stringify: " + JSON.stringify(obj));
        var paramsObj = {"address":btAddr, "service":bridgeServiceUuid, "characteristic":bridgeTxCharacteristicUuid};
        bluetoothle.descriptors(descriptorsIosTxSuccess, descriptorsIosTxError, paramsObj);
    }
    else
    {
        PrintLog(99, "Unexpected Rx descriptors bridge status: " + obj.status);
        DisconnectBluetoothDevice();
    }
}


function descriptorsIosRxError(obj)
{
    PrintLog(99, "Descriptors Rx Bridge error: " + obj.error + " - " + obj.message);
    DisconnectBluetoothDevice();
}



function descriptorsIosTxSuccess(obj)
{
    if (obj.status == "descriptors")
    {
        PrintLog(1, "BT: Tx Discovery completed, now subscribe.  Name: " + obj.name + " add: " + obj.address + "  stringify: " + JSON.stringify(obj));

        // Now subscribe to the bluetooth tx characteristic...
        SubscribeBluetoothDevice();
    }
    else
    {
        PrintLog(99, "Unexpected Tx descriptors bridge status: " + obj.status);
        DisconnectBluetoothDevice();
    }
}


function descriptorsIosTxError(obj)
{
    PrintLog(99, "Descriptors Tx Bridge error: " + obj.error + " - " + obj.message);
    DisconnectBluetoothDevice();
}
// End IOS only ...............................................................................................


// Android only ...............................................................................................
function discoverSuccess(obj)
{
    if (obj.status == "discovered")
    {
        PrintLog(1, "BT: Discovery completed.  Name: " + obj.name + " add: " + obj.address + "  stringify: " + JSON.stringify(obj));

        // Default to TI services...
        bridgeServiceUuid           = myTiServiceUuid;              // "48d60a60-f000-11e3-b42d-0002a5d5c51b";
        bridgeTxCharacteristicUuid  = myTiTxCharacteristicUuid;     // "6711";       // Tx from the bluetooth device profile, Rx for the phone app.
        bridgeRxCharacteristicUuid  = myTiRxCharacteristicUuid;     // "6722";       // Rx from our bluetooth device profile, Tx for the phone app.
        
        
        for( var i = 0; i < obj.services.length; i++ )
        {
            PrintLog(1, "  services:" + obj.services[i].uuid );
            if( obj.services[i].uuid.toUpperCase() == myMcServiceUuid.toUpperCase() )
            {
                PrintLog(1, "  Microchip BTLE discovered...use transparent services...")

                bridgeServiceUuid           = myMcServiceUuid;
                bridgeTxCharacteristicUuid  = myMcTxCharacteristicUuid;
                bridgeRxCharacteristicUuid  = myMcRxCharacteristicUuid;
                break;
            }
        }
        
        
        // Now subscribe to the bluetooth tx characteristic...
        SubscribeBluetoothDevice();

        // Start subscribing for the notifications in 1 second to allow any connection changes
        // to take place.
//        subscribeTimer = setTimeout(SubscribeBluetoothDevice, 1000);
        if( window.device.platform == androidPlatform  ) 
        {
            requestConnectionPriority("high"); //Request a higher connection on Android (lowers connection interval?)
        }
    }
      else
      {
        PrintLog(99, "BT: Unexpected discover status: " + obj.status);
        DisconnectBluetoothDevice();
      }
}

function discoverError(obj)
{
  PrintLog(99, "Discover error: " + obj.error + " - " + obj.message);
  DisconnectBluetoothDevice();
}
// End Android only ...............................................................................................


function requestConnectionPriority(connectionPriority) {
  //console.error("Request Connection Priority");
  var paramsObj = {address:btAddr, connectionPriority:connectionPriority};
  bluetoothle.requestConnectionPriority(function(obj) {
    //console.error("RCP Success:" + JSON.stringify(obj));
  }, function(obj) {
    //console.error("RCP Error:" + JSON.stringify(obj));
  }, paramsObj);
}

// SubscribeBluetoothDevice........................................................................
//  Subscribe means to listen on this UUID, i.e. channel, from the BLE device.
function SubscribeBluetoothDevice()
{
    PrintLog(1, "BT: SubscribeBluetoothDevice()" );

    // Version 1.0.2 of the plugin
    var paramsObj = {"address":btAddr, "service":bridgeServiceUuid, "characteristic":bridgeTxCharacteristicUuid, "isNotification":true};

    bluetoothle.subscribe(subscribeSuccess, subscribeError, paramsObj);
}


function subscribeSuccess(obj)
{
    if (obj.status == "subscribedResult")
    {
        PrintLog(10, "BT: Subscription data received");

        // If we have asked for a disconnect, then do not process any more Rx data...
        if( bDisconnectCalled == false )
        {
            var u8 = bluetoothle.encodedStringToBytes(obj.value);
            if (u8.length != 0)
            {
                if(bUseThunkLayer)      // Rx from BT into thunker
                {
/*                    
                    if( PrintLogLevel >= 2 )
                    {
                        var outText = u8[0].toString(16);    // Convert to hex output...
                        for( var i = 1; i < u8.length; i++ )
                        {
                            if( !(i%44) )
                            {
                                PrintLog(2,  "Msg Rx:d: " + outText );
                                outText = u8[i].toString(16);
                            }
                            else
                            {
                                outText = outText + " " + u8[i].toString(16);
                            }
                        }
                        
                        if( outText.length > 0 )
                        {
                            PrintLog(2,  "Msg Rx:d: " + outText );
                        }
                       
                    }
*/
                    
                    for( var i = 0; i < u8.length; i++ )
                    {
                        u8ThunkRx[i] = u8[i];
                    }
                    
                    u8ThunkRxCount      += (u8.length - 4);
                    u8ThunkRxCountTotal += (u8.length - 4);
                    
                    // bluetooth --> In  --- thunk - thunk - thunk --> ReadRxThunkOut --> nxty ICD msg
//                    if( (window.device.platform == androidPlatform) && (parseFloat(window.device.version) < 8) )      // Android 8.0 is API 26 
                    if( (window.device.platform == androidPlatform) )      
                    {
                        Module._ReadRxThunkInReorder( u8ThunkRx.byteOffset, u8.length );
                    }
                    else
                    {
                        // IOS does not have the modified plugin so feed the packets in directly.  IOS should not have the reordering problem.
                        Module._ReadRxThunkIn( u8ThunkRx.byteOffset, u8.length );
                    }
                     
                }
                else
                {
                    // An Android platform has the modified BT plugin which adds 4 bytes to the front for reordering.
                    if( (window.device.platform == androidPlatform) )      
                    {
                        nxty.ProcessNxtyRxMsg( u8.slice(4), (u8.length - 4) );
                    }
                    else
                    {
                        // IOS does not have the modified plugin.
                        nxty.ProcessNxtyRxMsg( u8, u8.length );
                    }
                        
                }
            }
        }

    }
    else if (obj.status == "subscribed")
    {
        PrintLog(1, "BT: Subscription started - BT now able to receive Rx msgs.");
        ClearNxtyMsgPending();              // Make sure not stuck waiting for a response...
        isBluetoothSubscribed = true;
        UpdateBluetoothIcon( true );        // Wait until here before saying isSouthBoundIfCnx
        bDisconnectCalled = false;          // Allow Rx Data to be processed...
    }
    else
    {
        PrintLog(99, "BT: Unexpected subscribe status: " + obj.status);
        DisconnectBluetoothDevice();
    }
}

function subscribeError(msg)
{
    if( bDisconnectCalled == false )
    {
        PrintLog(99, "BT: Subscribe error: " + msg.error + " - " + msg.message);
    }
}

function unsubscribeDevice()
{
  PrintLog(1, "BT: Unsubscribing bridge service");
  var paramsObj = {"address":btAddr, "service":bridgeServiceUuid, "characteristi":bridgeTxCharacteristicUuid};
  bluetoothle.unsubscribe(unsubscribeSuccess, unsubscribeError, paramsObj);
}

function unsubscribeSuccess(obj)
{
    if (obj.status == "unsubscribed")
    {
        PrintLog(1, "BT: Unsubscribed device");
        isBluetoothSubscribed = false;
    }
    else
    {
      PrintLog(99, "BT: Unexpected unsubscribe status: " + obj.status);
      DisconnectBluetoothDevice();
    }
}

function unsubscribeError(obj)
{
  PrintLog(99, "BT: Unsubscribe error: " + obj.error + " - " + obj.message);
  DisconnectBluetoothDevice();
}

// WriteSouthBoundData........................................................................
function WriteSouthBoundData( u8 )
{
    if( isSouthBoundIfCnx == false )
    {
        PrintLog(99, "BT: WriteSouthBoundData()...BT not connected..." ); 
        return(false);
    }
    
    // For Skal non-AB messages, add the prefix 0x2A, len, crclen.  
    // Note that the Skal BT processor will strip off the 3 bytes before sending to GO.
    if( bSouthBoundSkalCnx )
    {
        if( !((u8[0] == NXTY_SKAL_THRU_PREFIX) || (u8[0] == NXTY_V2_AB_PREFIX)) )
        {
            var u8Temp  = new Uint8Array(u8.length + 3);
            u8Temp[0] = NXTY_SKAL_THRU_PREFIX;
            u8Temp[1] = u8.length;
            u8Temp[2] = nxty.CalcCrc8Byte( u8Temp[1] );
            
            for( var i = 0; i < u8.length; i++ )
            {
                u8Temp[3+i] = u8[i];
            }
            
            u8 = u8Temp.slice(0);
        }
    }


    if(bUseThunkLayer)  // Tx to thunker...
    {
        if( bRxThunkPending == false )
        {
            bRxThunkPending = true;
         
            if( PrintLogLevel >= 2 )
            {
                var outText = u8[0].toString(16);    // Convert to hex output...
                for( var i = 1; i < u8.length; i++ )
                {
                    if( !(i%44) )
                    {
                        PrintLog(2,  "Msg Tx: " + outText );
                        outText = u8[i].toString(16);
                    }
                    else
                    {
                        outText = outText + " " + u8[i].toString(16);
                    }
                }
                
                if( outText.length > 0 )
                {
                    PrintLog(2,  "Msg Tx: " + outText );
                }
            }

            for( var i = 0; i < u8.length; i++ )
            {
                u8ThunkTx[i] = u8[i];
            }
            
            // In  --- thunk - thunk - thunk --> SendTxThunkOut --> bluetooth
            Module._SendTxThunkIn( u8ThunkTx.byteOffset, u8.length );
        }
        else
        {
            PrintLog(99, "BT: Waiting on Thunk Response from ReadRxThunkOut(). Tx aborted." );
            ClearNxtyMsgPending();              // Make sure not stuck waiting for a response...
            return(false);
        }
    }
    else
    {
        if( PrintLogLevel >= 2 )
        {
            var outText = u8[0].toString(16);    // Convert to hex output...
            for( var i = 1; i < u8.length; i++ )
            {
                if( !(i%44) )
                {
                    PrintLog(2,  "Msg Tx: " + outText );
                    outText = u8[i].toString(16);
                }
                else
                {
                    outText = outText + " " + u8[i].toString(16);
                }
            }
            
            if( outText.length > 0 )
            {
                PrintLog(2,  "Msg Tx: " + outText );
            }
        }

        var paramsObj = {"address":btAddr, "value":bluetoothle.bytesToEncodedString(u8), "service":bridgeServiceUuid, "characteristic":bridgeRxCharacteristicUuid, "type":"noResponse"};
        bluetoothle.writeQ(writeSuccessQ, writeErrorQ, paramsObj);
    }

    return(true);

/*
jdo: old way of delevering messages based on time and connection interval.

    var i;

    // Check msg length...
    if( u8.length > u8TxBuff.length )
    {
        PrintLog(99, "BT: WriteSouthBoundData(len=" + u8.length + "): More than " + NXTY_BIG_MSG_SIZE + " bytes." );
        return;
    }

    uTxMsgLen  = u8.length;
    uTxBuffIdx = 0;

    // Transfer the complete message to our working buffer...
    for( i = 0; i < uTxMsgLen; i++ )
    {
        u8TxBuff[i] = u8[i];
    }

    if( (window.device.platform == iOSPlatform) &&  (swVerBtScan.localeCompare("01.00") == 0) )
    {
        // For version 1.00 on the BT board for IOS we have to slow it way down and use one buffer.
        maxPhoneBuffer = 1;
    }

    // Do it....
    WriteBluetoothDeviceEx();
*/    
}


function writeSuccessQ(obj)
{
//  PrintLog(1, "BT: WriteQ success: " + obj.status);
    if(bUseThunkLayer)  // Tx to thunker...
    {
        Module._TxComplete();
    }
}

function writeErrorQ(msg)
{
    PrintLog(99, "BT: WriteQ error: " + msg.error + " - " + msg.message);
    
    if(bUseThunkLayer)  // Tx to thunker...
    {
        Module._TxComplete();
    }
}


// Output of the thunker...
// 
function SendTxThunkOut(u8)
{
/*    
    if( PrintLogLevel >= 2 )
    {
        var outText = u8[0].toString(16);    // Convert to hex output...
        for( var i = 1; i < u8.length; i++ )
        {
            if( !(i%44) )
            {
                PrintLog(2,  "Msg Tx:d: " + outText );
                outText = u8[i].toString(16);
            }
            else
            {
                outText = outText + " " + u8[i].toString(16);
            }
        }
        
        if( outText.length > 0 )
        {
            PrintLog(2,  "Msg Tx:d: " + outText );
        }
    }
*/
    
    var paramsObj = {"address":btAddr, "value":bluetoothle.bytesToEncodedString(u8), "service":bridgeServiceUuid, "characteristic":bridgeRxCharacteristicUuid, "type":"noResponse"};
    bluetoothle.writeQ(writeSuccessQ, writeErrorQ, paramsObj);
}

// Rx thunker thinks it has a message, so drop into our normal processing...
function ReadRxThunkOut(u8)
{
    u8IcdRxCountTotal += u8.length;
    PrintLog(1,  "Rx Stat: RxR Total=" + u8ThunkRxCountTotal + " RxIcd Total=" + u8IcdRxCountTotal );
    bRxThunkPending = false;
    nxty.ProcessNxtyRxMsg( u8, u8.length );
}


// This is the actual work horse that gets called repeatedly to send the data out ..........................................
function WriteBluetoothDeviceEx()
{
    var i;
    var j;
    var paramsObj = [];
    var myRtnTimer;
    var numBuffersOut = 0;

    // Come back next BT connection interval if more to output...
    myRtnTimer = setTimeout( function(){ WriteBluetoothDeviceEx(); }, btCnxInterval );  // Call myself...

    var ds  = new Date();
    var sMs = ds.getMilliseconds();


    for( j = 0; j < maxPhoneBuffer; j++ )
    {
        // See if we have more to output...
        if( uTxBuffIdx < uTxMsgLen )
        {

            var uTxBuffIdxEnd = uTxBuffIdx + TX_MAX_BYTES_PER_BUFFER;
            if( uTxBuffIdxEnd > uTxMsgLen )
            {
                uTxBuffIdxEnd = uTxMsgLen;
            }

            var u8Sub  = u8TxBuff.subarray(uTxBuffIdx, uTxBuffIdxEnd);
            var u64    = bluetoothle.bytesToEncodedString(u8Sub);

            if( PrintLogLevel >= 2 )
            {
                var outText = u8Sub[0].toString(16);    // Convert to hex output...
                for( i = 1; i < (uTxBuffIdxEnd - uTxBuffIdx); i++ )
                {
                    outText = outText + " " + u8Sub[i].toString(16);
                }
                PrintLog(2,  "Msg Tx: " + outText );
            }

            if( (window.device.platform == iOSPlatform) &&  (swVerBtScan.localeCompare("01.00") == 0) )
            {
                // If bluetooth version is 01.00 then use Response, otherwise we can use the faster no response.
                // Problem is that in version 01.00 of the bluetooth code I did not set the WRITE-NO-RESPONSE bit.
                // Version 01.00: Use WRITE with response, slower
                paramsObj[j] = {"address":btAddr, "value":u64, "service":bridgeServiceUuid, "characteristic":bridgeRxCharacteristicUuid};

                // Don't use the timer to come back, use the Succes function.
                clearTimeout(myRtnTimer);
            }
            else
            {
                // Normal operation for android.
                // Normal operation for IOS when BT version > 1.00.
                paramsObj[j] = {"address":btAddr, "value":u64, "service":bridgeServiceUuid, "characteristic":bridgeRxCharacteristicUuid, "type":"noResponse"};
            }

            // Each call to the write takes 5 to 10 mS on my Android phone.
            bluetoothle.write(writeSuccess, writeError, paramsObj[j]);
            numBuffersOut++;

            uTxBuffIdx = uTxBuffIdxEnd;

            if( window.device.platform == iOSPlatform )
            {
                // Exit the loop if 6 buffers have been written in under 30 mS.
                // IOS has a max of 6 buffers and our connection interval should be 30 mS.
//                if( j == 5 )
                if( j == 3 )                            // Since we need 7 buffers total for the 132 bytes, just exit at 4 to be same as Android.
                {
                    var de  = new Date();
                    var eMs = de.getMilliseconds();
                    var deltsMs;

                    if( eMs > sMs )
                    {
                        deltaMs = eMs - sMs;
                    }
                    else
                    {
                        deltaMs = 1000 - sMs + eMs;
                    }

                    // Less than 30 mS?
                    if( deltaMs < 30 )
                    {
//                        PrintLog(1, "Msg Tx loop exit after 6 buffers.  Time: " + deltaMs + " < 30 mS");
                        break;
                    }
                }

            }
            else
            {
                // Exit the loop if 4 buffers have been written in under 20 mS.
                // Android has a max of 4 buffers and our connection interval should be 20 mS.
                if( j == 3 )
                {
                    var de  = new Date();
                    var eMs = de.getMilliseconds();
                    var deltsMs;

                    if( eMs > sMs )
                    {
                        deltaMs = eMs - sMs;
                    }
                    else
                    {
                        deltaMs = 1000 - sMs + eMs;
                    }

                    // Less than 20 mS?
                    if( deltaMs < 20 )
                    {
//                        PrintLog(1, "Msg Tx loop exit after 4 buffers.  Time: " + deltaMs + " < 20 mS");
                        break;
                    }
                }
            }

        }
        else
        {
            break;
        }
    }

    if( uTxBuffIdx >= uTxMsgLen )
    {
        // Kill the come back timer if no more data...
        clearTimeout(myRtnTimer);
    }

    PrintLog(1,  "BT Tx: buffersLoaded=" + numBuffersOut + " msgBytes=" + uTxBuffIdx );
}


function writeSuccess(obj)
{
    // {"status":"written","service":"180F","characteristic":"2A19","value":""};
    if( obj.status == "written" )
    {
        if( (window.device.platform == iOSPlatform) &&  (swVerBtScan.localeCompare("01.00") == 0) )
        {
            setTimeout( function(){ WriteBluetoothDeviceEx(); }, 5 );  // Write some more in 5 mS.
        }
    }
    else
    {
        PrintLog(99, "BT: Unexpected write status: " + obj.status);
    }
}




function writeError(msg)
{
    PrintLog(99, "BT: Write error: " + msg.error + " - " + msg.message);

    bSouthBoundWriteError = true;

    if( window.device.platform == androidPlatform )
    {
        // Drop the number of buffers down to a min of 2...starts at 7
        if( maxPhoneBuffer > 4 )
        {
            SetBluetoothTxTimer(BT_CONNECTION_INTERVAL_DEFAULT);
            SetMaxTxPhoneBuffers(4);
        }
        else if( maxPhoneBuffer == 4 )
        {
            SetMaxTxPhoneBuffers(3);
        }
        else if( maxPhoneBuffer == 3 )
        {
            SetMaxTxPhoneBuffers(2);
        }
        else if( maxPhoneBuffer == 2 )
        {
            SetBluetoothTxTimer(BT_CONNECTION_INTERVAL_DEFAULT/2);
            SetMaxTxPhoneBuffers(1);
        }
    }
    else
    {
        // Set the connection interval timer back to 40 mS.
        SetBluetoothTxTimer(BT_CONNECTION_INTERVAL_DEFAULT);
    }

}

// SetBluetoothTxTimer...................................................................................
function SetBluetoothTxTimer(cnxTimeMs)
{
    btCnxInterval = cnxTimeMs;
    PrintLog(1, "BT: Setting Tx timer to " + btCnxInterval + " mS" );
}


// SetMaxTxPhoneBuffers...................................................................................
function SetMaxTxPhoneBuffers(numBuffers)
{
    maxPhoneBuffer = numBuffers;
    PrintLog(1, "BT: SetMaxTxPhoneBuffers: " + maxPhoneBuffer );
}



// ConnectSouthBoundIf........................................................................
function ConnectSouthBoundIf(myIdx)
{
    PrintLog(1, "BT: ConnectSouthBoundIf(" + myIdx + ") addr: " + guiDeviceMacAddrList[myIdx] );
    ConnectBluetoothDevice( guiDeviceMacAddrList[myIdx] );

    // Start the saftey check...
    BluetoothCnxTimer = setTimeout(BluetoothLoop, 10000);
}


// RefreshSouthBoundIf........................................................................
function RefreshSouthBoundIf()
{
    PrintLog(1, "BT: RefreshSouthBoundIf() i.e. disconnect and reconnect" );
    bRefreshActive = true;
    DisconnectBluetoothDevice();

}



// DisconnectAndStopSouthBoundIf........................................................................
function DisconnectAndStopSouthBoundIf()
{
    PrintLog(1, "BT: DisconnectAndStopSouthBoundIf()..." );
    
    clearTimeout(BluetoothCnxTimer);
    BluetoothCnxTimer = null;    
    DisconnectBluetoothDevice();
}

// RestartSouthBoundIf........................................................................
function RestartSouthBoundIf(bClean, bClearBabbleList)
{
    if( bClean )
    {
        PrintLog(1, "BT: RestartSouthBoundIf( CLEAN )" );
       
        
        // Clear any history...
        myLastBtAddress   = null;
        guiDeviceMacAddrList = [];     
        icdBtList            = [];
        guiDeviceRssiList    = [];               
        guiDeviceSnList      = [];
        guiDeviceTypeList    = [];
        guiDeviceSubSnList   = [];
        guiDeviceSubCnxList  = [];
        icdDeviceList        = []; 
        boardCfgList         = [];
        bBtTryingToCnx       = false;
        bTryConnectCalled    = false;
        
        if( bClearBabbleList )
        {
            PrintLog(1, "  - clear babbling MAC addresses..." );
            window.localStorage.removeItem( BABBLING_MAC_ID );
        }
        
        BluetoothLoop();
    }
    else
    {
        PrintLog(1, "BT: RestartSouthBoundIf(" + myLastBtAddress + ")..." );
        
        if( (isSouthBoundIfCnx == false) && (myLastBtAddress != null) )
        {
            ConnectBluetoothDevice(myLastBtAddress);
        }
            
        // Start the loop again...
        if( BluetoothCnxTimer == null )
        {
            BluetoothCnxTimer = setTimeout(BluetoothLoop, 10000);
        }
    }
    
}




// GetBluetoothRssi........................................................................
var rssiLast;
var rssiSameCount = 0;

function GetBluetoothRssi()
{
    var paramsObj = {"address":myLastBtAddress};

    bluetoothle.rssi(rssiSuccess, rssiError, paramsObj);
}


function rssiSuccess(obj)
{
    if (obj.status == "rssi")
    {
//        PrintLog(10, "BT: RSSI data received" + obj.rssi );
        UpdateRssiLine( obj.rssi );
        
        if( rssiLast == obj.rssi )
        {
            rssiSameCount++
        }
        else
        {
            rssiSameCount = 0;
        }
        rssiLast = obj.rssi;
        
        if( rssiSameCount > 9 )
        {
            UpdateBluetoothIcon( false );
        }
    }
}

function rssiError(msg)
{
    PrintLog(99, "BT: GetRssi error: " + msg.error + " - " + msg.message);
}






//----------------------------------------------------------------------------------------
function ReverseArrayItems( myRevArray, myRevIdx )
{
    var temp;
    
    if( myRevArray.length >= 1 )
    {
        temp = myRevArray[myRevIdx-1];       
        myRevArray[myRevIdx-1] = myRevArray[myRevIdx];      
        myRevArray[myRevIdx] = temp;
    }
    else
    {
        PrintLog(99, "BT: ReverseArrayItems() array < 1" );
    }
}

//----------------------------------------------------------------------------------------
function tryConnect()
{
    // See if we have already been this way just in case called multile times while searching for guiDeviceMacAddrList[].
    if( bTryConnectCalled == false )
    {
        bTryConnectCalled = true;
        PrintLog(1, "BT: List of BT devices complete.  Number of BT MAC Addresses found = " + guiDeviceMacAddrList.length );

/*
jdo: no longer connect automatically if only 1 BT since we now need to read the board config first.

        // Automatically connect if only 1 BT in the area...
        if( guiDeviceMacAddrList.length == 1 )
        {
            PrintLog(1, "BT: FindMyCelfi() will not be called since only one BT device found and we do not have ICD version yet." );
            
            if( maxRssiAddr == null )
            {
                ConnectBluetoothDevice(guiDeviceMacAddrList[0]);
            }
            else
            {
                ConnectBluetoothDevice(maxRssiAddr);
            }
            
            isSouthBoundIfListDone = true;      // Main app loop must be placed on hold until true.
        }
        else if(guiDeviceMacAddrList.length > 1)
*/
        
        {

            // Sort the list based on RSSI power...
            for( var i = 0; i < guiDeviceMacAddrList.length; i++ )
            {
                for( var j = 1; j < guiDeviceMacAddrList.length; j++ )
                {
                    if( guiDeviceRssiList[j] > guiDeviceRssiList[j-1] )
                    {
                        // Reverse...
                        ReverseArrayItems(guiDeviceMacAddrList, j);
                        ReverseArrayItems(guiDeviceRssiList, j);
                        ReverseArrayItems(icdBtList, j);
                        ReverseArrayItems(guiDeviceSnList, j);
                        ReverseArrayItems(guiDeviceTypeList, j);
                        ReverseArrayItems(guiDeviceSubSnList, j);
                        ReverseArrayItems(guiDeviceSubCnxList, j);
                        ReverseArrayItems(icdDeviceList, j);
                        ReverseArrayItems(boardCfgList, j);
                        ReverseArrayItems(skalBtMacAddrList, j);
                    }
                }
            }

            
/*
Do not fill here.  Now filled when a MAC address found...            
            // As a default throw the text "None" in the device list which will eventually contain SNs...
            for( var i = 0; i < guiDeviceMacAddrList.length; i++ )
            {
                guiDeviceSnList.push("None");
                guiDeviceTypeList.push("None");
                guiDeviceSubSnList.push("None");
                guiDeviceSubCnxList.push("None");
                icdDeviceList.push(0);
                boardCfgList.push(0);
                skalBtMacAddrList.push(0);
            }
*/

    //        guiDeviceFlag = true;
            clearTimeout(BluetoothCnxTimer);
            BluetoothCnxTimer = null;

            var tempIcdBtList = icdBtList.slice(0);
            PrintLog(1, "guiDeviceMacAddrList   = " + JSON.stringify(guiDeviceMacAddrList) ); // An array of device BT addresses to select.
            PrintLog(1, "icdBtList              = " + JSON.stringify(tempIcdBtList, stringifyReplaceToHex) );     // An array of BT ICD versions.
            PrintLog(1, "guiDeviceRssiList      = " + JSON.stringify(guiDeviceRssiList) ); // An array of RSSI values.
            PrintLog(1, "guiDeviceSnList        = " + JSON.stringify(guiDeviceSnList) );     // An array of Serial Numbers.

            // Get the Serial Numbers for all detected BT devices...
            getSnIdx    = 0;
            getSnState  = 0;
            guiNumDevicesFound = 0;
            

            var tempList = window.localStorage.getItem( BABBLING_MAC_ID );
            if( tempList == null )
            {
                babblingMacsList    = [];
            }
            else
            {
                babblingMacsList = JSON.parse(window.localStorage.getItem( BABBLING_MAC_ID ));
            }
            PrintLog(1, "BT: Babbling MAC list:" + babblingMacsList );
            setTimeout( GetDeviceSerialNumbersLoop, 100 );
        }
    }
}


// GetDeviceSerialNumbersLoop........................................................................
var getSnLoopCounter = 0;
function GetDeviceSerialNumbersLoop()
{
    var i;
    PrintLog(10, "BT: GetDeviceSerialNumbersLoop()... idx=" + getSnIdx + " state=" + getSnState + " Counter=" + getSnLoopCounter + " len=" + guiDeviceSnList.length );

    // Find the SNs and place in guiDeviceSnList[] up to a max of 8.  
//    if( (getSnIdx < guiDeviceMacAddrList.length) && (guiNumDevicesFound < 8) && (bPhoneInBackground == false)  )
    if( (getSnIdx < guiDeviceMacAddrList.length) && (guiNumDevicesFound < 1) && (bPhoneInBackground == false)  )  // FollowMe set max to 1 to connect to the highest RSSI only.
    {
        var bBabblingMac = false;
        for( i = 0; i < babblingMacsList.length; i++)
        {
            if( babblingMacsList[i] == guiDeviceMacAddrList[getSnIdx] ) 
            {
                bBabblingMac = true; 
            }
        }
        
        if( guiDeviceRssiList[getSnIdx] < -95 )
        {
            PrintLog(1, "BT: Skip BT device " +  guiDeviceMacAddrList[getSnIdx] + "  RSSI below -95.  RSSI = " + guiDeviceRssiList[getSnIdx] );
            getSnIdx++;
            getSnLoopCounter = 0;
        }
        else if( bBabblingMac )
        {
            PrintLog(1, "BT: Skip BT device " +  guiDeviceMacAddrList[getSnIdx] + ", previously noted as babbling." );
            getSnIdx++;
            getSnLoopCounter = 0;
        }
        else if( guiDeviceSnList[getSnIdx] != "None" )
        {
            PrintLog(1, "BT: Skip BT device, SN already found.  SN=" +  guiDeviceSnList[getSnIdx] );
            guiNumDevicesFound++;
           
            if( guiNumDevicesFound == 1 )
            {
                // Save the index just in case this is the only one found...
                firstFoundIdx = getSnIdx;
            }
            getSnIdx++;
            getSnLoopCounter = 0;

        }
        else
        {
            switch(getSnState)
            {
                // Connect to BT device
                case 0:
                {
                    myLastBtAddress = null;             // Make sure no memory of previous connections.
                    SouthBoundCnxErrorCount = 0;
                    if( (isSouthBoundIfCnx == false) && (bBtTryingToCnx == false) )
                    {
                        getSnLoopCounter = 0;
                        ConnectBluetoothDevice(guiDeviceMacAddrList[getSnIdx]);
                        getSnState = 1;
                    }
                    break;
                }
    
                // Wait until device connected then try to get ICD version...
                case 1:
                {
                    if( isSouthBoundIfCnx )
                    {
                        if( (icdBtList[getSnIdx] & BT_ICD_TYPE_SKAL) == BT_ICD_TYPE_SKAL)
                        {
                            // Just connected to a Skal...shut down any logging so the SN does not get messed with...
                            PrintLog(1, "BT: Skal: shut down PIC-GO logging for now...");
                            guiDeviceTypeList[getSnIdx] = "Antenna";         // An array of device types, "Antenna", "2BoxNu", "2BoxCu", "1Box", "Cable"  (Antenna for Skal)
                            var u8TempBuff  = new Uint8Array(2);
                            u8TempBuff[0] = 0;                              // disable logging
                            nxty.SendNxtyMsg(NXTY_AB_SET_SKAL_GO_LOG_REQ, u8TempBuff, 1);
                            getSnState = 2;
                        }
                        else
                        {
                            if( bUseThunkLayer )
                            {
                                // Status command is not valid for BT_ICD_VER_2....
                                isNxtyStatusCurrent = true;
                            }
                            else
                            {
                                isNxtyStatusCurrent = false;
            
                                // Get the ICD version by getting the status message...
                                var u8TempBuff  = new Uint8Array(2);
                                u8TempBuff[0] = NXTY_PHONE_ICD_VER;
                                nxty.SendNxtyMsg(NXTY_STATUS_REQ, u8TempBuff, 1);
                            }
                            getSnState = 2;
                        }
                    }
                    break;
                }
    
                // Wait until ICD version known and then get Serial Number...
                case 2:
                {
                    if( (icdBtList[getSnIdx] & BT_ICD_TYPE_SKAL) == BT_ICD_TYPE_SKAL)
                    {
                        // Skal...move along once we have received a response...
                        if( msgRxLastCmd != NXTY_WAITING_FOR_RSP )
                        {
                            getSnState = 3;
                            icdDeviceList[getSnIdx] = V2_ICD;         // Force PIC ICD to version 2 for Skal
                        }
                    }
                    else
                    {
                        // Non Skal: 
                        if( isNxtyStatusCurrent )
                        {
                            if( bUseThunkLayer )
                            {
                                nxtyRxStatusIcd = V4_ICD;         // Use thunk layre with debug protocol: Force PIC ICD to version 4 for BT version 2, BT_ICD_VER_2.
                            }

                            icdDeviceList[getSnIdx] = nxtyRxStatusIcd;
                            
                            if( nxtyRxStatusIcd <= V1_ICD )
                            {
                                // Board config is returned in V1 status message.
                                boardCfgList[getSnIdx] = nxtyRxStatusBoardConfig;
                                
                                if( (boardCfgList[getSnIdx] & BOARD_CFG_CABLE_BOX_BIT) == BOARD_CFG_USE_THIS_DEVICE )
                                {
                                    // Old ICD...do not update automatically...
                                    // When this BT logic was added the v1 protocol had been removed.
                                    //   V1 protocol was later added but SN was never added for V1.  
                                    guiDeviceSnList[getSnIdx] = "Connect to Update";
                                    guiNumDevicesFound++;
            
                                    if( guiNumDevicesFound == 1 )
                                    {
                                        // Save the index just in case this is the only one found...
                                        firstFoundIdx = getSnIdx;
                                    }
                                        
                                    if( bPrivacyViewed == true )
                                    {
                                        var outText = GetLangString("Found") + " " + guiNumDevicesFound + " ";
                                        if( guiNumDevicesFound == 1 )
                                        {
                                            outText += GetLangString("CelFiDevice");
                                        }
                                        else
                                        {
                                            outText += GetLangString("CelFiDevices");
                                        }
    
                                        document.getElementById("searchMessageBox").innerHTML = outText;
                                        UpdateStatusLine( outText );
                                    }
                                }
                                
                                // Disconnect from BT...
                                DisconnectBluetoothDevice();
                                getSnState = 0;
                                getSnIdx++;
                            }
                            else
                            {
                                GetBoardConfig();   // Get the board config to see if cable box, bit 14 set, or not. Also check for G32 type of antenna control.
                                getSnState = 3;
                            }
                        }
                        else
                        {
                            if( !(getSnLoopCounter % 12) )
                            {
                                // Try sending again...every 12/24/36 counts
                                msgRxLastCmd = NXTY_INIT;   // Clear any pending msg.
                                getSnState = 1;
                            }
                        }
                    }
                    break;
                }
    
                // Wait until Board Config has been returned and then get SN if using this device...
                case 3:
                {
                    if( (icdBtList[getSnIdx] & BT_ICD_TYPE_SKAL) == BT_ICD_TYPE_SKAL)
                    {
                        // Skal: Just connected to a Skal...Get GO SN, GO CNX status and Skal SN...
                        if( guiDeviceSubSnList[getSnIdx] == "None" )
                        {
                            PrintLog(1, "BT: Skal: Get GO SN...");
                            guiDeviceSubSnList[getSnIdx] = "Req";
                            var u8TempBuff  = new Uint8Array(2);
                            u8TempBuff[0] = NXTY_AB_READ_DATA_GO_SN;
                            nxty.SendNxtyMsg(NXTY_AB_READ_DATA_REQ, u8TempBuff, 1);
                        }
                        else if( guiDeviceSubSnList[getSnIdx] == "Req" )
                        {
                            if( msgRxLastCmd != NXTY_WAITING_FOR_RSP )
                            {
                                if( msgRxLastCmd == NXTY_AB_READ_DATA_RSP)
                                {
                                    guiDeviceSubSnList[getSnIdx] = "";
                                    for( var i = 0; i < 6; i++ )
                                    {
                                        guiDeviceSubSnList[getSnIdx] += U8ToHexText(u8RxBuff[5+i]);
                                    }
                                }
                                else
                                {
                                    guiDeviceSubSnList[getSnIdx] = "Unknown";
                                }

                                PrintLog(1, "BT: Skal: Get GO Cnx Status...");
                                guiDeviceSubCnxList[getSnIdx] = "Req";
                                nxty.SendNxtyMsg(NXTY_AB_GET_GO_CNX_STAT_REQ, null, 0);
                            }
                        }
                        else if( guiDeviceSubCnxList[getSnIdx] == "Req" )
                        {
                            if( msgRxLastCmd != NXTY_WAITING_FOR_RSP )
                            {
                                if( msgRxLastCmd == NXTY_AB_GET_GO_CNX_STAT_RSP)
                                {
                                    if( u8RxBuff[4] == 0x01 )       // u8RxBuff[4] can return 0, 1 or 0xbb for babbling.
                                    {
                                        guiDeviceSubCnxList[getSnIdx] = "Cnx";
                                    }
                                    else
                                    {
                                        guiDeviceSubCnxList[getSnIdx] = "DCnx";
                                    }
                                }
                                else
                                {
                                    guiDeviceSubCnxList[getSnIdx] = "Unknown";
                                }
                        
                                var u8TempBuff  = new Uint8Array(2);
                                u8TempBuff[0] = NXTY_AB_READ_DATA_SKAL_MAC;
                                nxty.SendNxtyMsg(NXTY_AB_READ_DATA_REQ, u8TempBuff, 1);
                                getSnState = 4;
                            }
                        }
                    }
                    else
                    {
                        // Non Skal:
                        if( bNxtySuperMsgRsp == true )
                        {
                            if( iNxtySuperMsgRspStatus == NXTY_SUPER_MSG_STATUS_SUCCESS )
                            {                    
                                boardCfgList[getSnIdx] = nxtyRxStatusBoardConfig;
                                
                                if( (boardCfgList[getSnIdx] & BOARD_CFG_CABLE_BOX_BIT) == BOARD_CFG_USE_THIS_DEVICE )
                                {
                                    if( boardCfgList[getSnIdx] & IM_A_1BOX_NU_MASK )
                                    {
                                        if( bSkalAntControlFlag == false )
                                        {
                                            guiDeviceTypeList[getSnIdx] = "1Box";         // An array of device types, "Antenna", "2BoxNu", "2BoxCu", "1Box", "Cable"  (Antenna for Skal)
                                        }
                                        else
                                        {
                                            // 1box with Antenna control for Skal.
                                            guiDeviceTypeList[getSnIdx] = "1BoxA";        // An array of device types, "Antenna", "2BoxNu", "2BoxCu", "1Box", "Cable"  (Antenna for Skal)
                                        }
                                    }
                                    else if(boardCfgList[getSnIdx] & IM_A_CU_MASK)
                                    {
                                        guiDeviceTypeList[getSnIdx] = "2BoxCu";         // An array of device types, "Antenna", "2BoxNu", "2BoxCu", "1Box", "Cable"  (Antenna for Skal)
                                    }
                                    else
                                    {
                                        guiDeviceTypeList[getSnIdx] = "2BoxNu";         // An array of device types, "Antenna", "2BoxNu", "2BoxCu", "1Box", "Cable"  (Antenna for Skal)
                                    }

                                    // Get the SN since this device meets our needs...
                                    GetNxtySuperMsgParamSelect( NXTY_SEL_PARAM_REG_SN_MSD_TYPE, NXTY_SEL_PARAM_REG_SN_LSD_TYPE );
                                    getSnState = 4;
                                }
                                else
                                {
                                    // Disconnect from BT...
                                    guiDeviceTypeList[getSnIdx] = "Cable";         // An array of device types, "Antenna", "2BoxNu", "2BoxCu", "1Box", "Cable"  (Antenna for Skal)
                                    DisconnectBluetoothDevice();
                                    getSnState = 0;
                                    getSnIdx++;
                                }
                            }
                            else
                            {
                                // Do not retry since unit may be marginally out of range...
                                DisconnectBluetoothDevice();
                                getSnState = 0;
                                getSnIdx++;
                            }
                            
                        }
                    }    
                    break;
                }
                
                // Wait until SN has been returned and then disconnect...
                case 4:
                {
                    var tempSn = "";
                    if( (icdBtList[getSnIdx] & BT_ICD_TYPE_SKAL) == BT_ICD_TYPE_SKAL)
                    {
                        if( msgRxLastCmd != NXTY_WAITING_FOR_RSP )
                        {
                            var myMac = "";
                            for( i = 0; i < 6; i++ )
                            {
                                if( i == 0)
                                {
                                    myMac = U8ToHexText(u8RxBuff[5+i]);
                                }
                                else
                                {
                                    myMac += (":" + U8ToHexText(u8RxBuff[5+i]) );
                                }
                            }

                        
                        
                        
                            // Calculate the Skal SN based on the MAC address...
                            // Per LB email 1/29/18: For Skal the serial number is 60112764928 + Bottom-6-digits-of-MAC-address-converted-to-a-decimal-number
                            //   Since D2C003 = 13811715
                            //   For your board the SN is 60112764928 +13811715 = 60126576643
                            // Per LB email 1/30/18:  Add checksum character to the end.
                            //   Sorry forgot about the checksum digit (the number I gave you before only had 11 digits):
                            //   The SN for your board is:  601265766436
                            // myMac = guiDeviceMacAddrList[getSnIdx];   jdo: does not work on IOS since IOS MAC is mangled 
                            skalBtMacAddrList[getSnIdx] = myMac;
                            var myTemp = 60112764928 + parseInt("0x" + myMac.substring(9,11) + myMac.substring(12,14) + myMac.substring(15,17));
                            tempSn = myTemp.toString();
                            
                            // Calculate the checksum on the 11 characters...
                            var sum = 0;
                            for( i = 0; i < tempSn.length; i++ )
                            {
                                if( (i & 1) == 0 )
                                {
                                    sum += (3 * (tempSn[i] - '0'));
                                }
                                else
                                {
                                    sum += (tempSn[i] - '0');
                                }
                            }
                            
                            var checkSum = 10 - (sum % 10);
                            if (checkSum == 10)
                            {
                                checkSum = 0;
                            }
    
                            tempSn += checkSum;
                            PrintLog(1, "BT: Skal: Calculate Skal SN from BT MAC address. BT MAC=" + myMac + " SN=" + tempSn );
                        }
                        
                    }
                    else
                    {
                        if( bNxtySuperMsgRsp == true )
                        {
                            if( iNxtySuperMsgRspStatus == NXTY_SUPER_MSG_STATUS_SUCCESS )
                            {                    
                                for( i = 0; i < 6; i++ )
                                {
                                    if( i < 2 )
                                    {
                                        tempSn += U8ToHexText(u8RxBuff[9+i]);
                                    }
                                    else
                                    {
                                        tempSn += U8ToHexText(u8RxBuff[12+i]);    // [14] but i is already 2 so 14-2=12
                                    }
                                }
                            }
                        }
                    }
                     
                    if( tempSn.length )
                    {
                        guiDeviceSnList[getSnIdx] = "SN:" + tempSn;
                        guiNumDevicesFound++;
    
                        if( guiNumDevicesFound == 1 )
                        {
                            // Save the index just in case this is the only one found...
                            firstFoundIdx = getSnIdx;
                        }
                                
                        if( bPrivacyViewed == true )
                        {
                            var outText = GetLangString("Found") + " " + guiNumDevicesFound + " ";
                            if( guiNumDevicesFound == 1 )
                            {
                                outText += GetLangString("CelFiDevice");  // Found 1 Cel-Fi device...
                            }
                            else
                            {
                                outText += GetLangString("CelFiDevices");
                            }
                        
                            var myBox = document.getElementById("searchMessageBox");
                            if(myBox != null) 
                            { 
                                document.getElementById("searchMessageBox").innerHTML = outText;                            
                            }

                            UpdateStatusLine( outText );
                        }


                        if( guiDeviceMacAddrList.length > 1 )
                        {
                            // Disconnect from BT if more than 1 in list, i.e. favorite has only 1...
// FollowMe: do not disconnect here                            DisconnectBluetoothDevice();
                        }
                        getSnState = 0;
                        getSnIdx++;
                    }    
                    break;
                }
                
                
            }
        }

        getSnLoopCounter++;

        // Safety exit...
        if( ((bBtTryingToCnx == false) && (getSnLoopCounter > 10))   ||             // No sense to wait around if BT errors out.
            (SouthBoundCnxErrorCount > 12)                           ||             // Make sure connection doesn't spew TCP slip.
            (getSnLoopCounter > 40) )                                               // Never go more than 40, about 6 seconds
        {
            
            if( (bBtTryingToCnx == false) && (getSnLoopCounter > 10) )
            {
                PrintLog(1, "BT: GetDeviceSerialNumbersLoop() Did not cnx successfully. (bBtTryingToCnx == false and getSnLoopCounter > 10)");
            }
            else if(SouthBoundCnxErrorCount > 12)
            {
                PrintLog(1, "BT: GetDeviceSerialNumbersLoop(): " + guiDeviceMacAddrList[getSnIdx] + " Connected but babbling so disconnect (SouthBoundCnxErrorCount > 12)");
                babblingMacsList.push(guiDeviceMacAddrList[getSnIdx]);
                window.localStorage.setItem( BABBLING_MAC_ID, JSON.stringify(babblingMacsList) );
                PrintLog(1, "BT: Babbling MAC list:" + babblingMacsList );
                SouthBoundCnxErrorCount = 0;
            }
            else
            {
                PrintLog(1, "BT: GetDeviceSerialNumbersLoop() Timed out after 6 sec so disconnect.");
            }


            if( bBtTryingToCnx || isSouthBoundIfCnx )
            {
                DisconnectBluetoothDevice();
            }
//            else
//            {
//                bBtTryingToCnx     = false;
//            }
            
            getSnState = 0;
            getSnIdx++;
        }


        // Come back in 150 mS
        setTimeout( GetDeviceSerialNumbersLoop, 150 );
    }
    else
    {
//        StopWaitPopUpMsg();


        var tempIcdBtList  = icdBtList.slice(0);
        var tempIcdDevList = icdDeviceList.slice(0);
        var tempBoardCfgList = boardCfgList.slice(0);
        PrintLog(1, "guiDeviceMacAddrList   = " + JSON.stringify(guiDeviceMacAddrList) ); // An array of device BT addresses to select.
        PrintLog(1, "icdBtList              = " + JSON.stringify(tempIcdBtList, stringifyReplaceToHex) );     // An array of BT ICD versions.
        PrintLog(1, "guiDeviceRssiList      = " + JSON.stringify(guiDeviceRssiList) ); // An array of RSSI values.
        PrintLog(1, "guiDeviceSnList        = " + JSON.stringify(guiDeviceSnList) );     // An array of Serial Numbers.
        PrintLog(1, "guiDeviceTypeList      = " + JSON.stringify(guiDeviceTypeList) ); // "Antenna", "2BoxNu", "2BoxCu", "1Box", "Cable"  (Antenna for Skal)
        PrintLog(1, "guiDeviceSubSnList     = " + JSON.stringify(guiDeviceSubSnList) ); 
        PrintLog(1, "guiDeviceSubCnxList    = " + JSON.stringify(guiDeviceSubCnxList) );
        PrintLog(1, "icdDeviceList          = " + JSON.stringify(tempIcdDevList, stringifyReplaceToHex) );     // An array of ICD versions.
        PrintLog(1, "boardCfgList           = " + JSON.stringify(tempBoardCfgList, stringifyReplaceToHex) + " if bit 14 set, 0x4000, then cable box"  );
        PrintLog(1, "skalBtMacAddrList      = " + JSON.stringify(skalBtMacAddrList) );
        
        PrintLog(1, "Number non-cable found = " + guiNumDevicesFound );
        
        if( isSouthBoundIfCnx && (guiNumDevicesFound > 1) )
        {
            DisconnectBluetoothDevice();
            isSouthBoundIfCnx = false;
            myLastBtAddress   = null;             // Make sure no memory of previous connections.
        }
        
        
        // Bug 1518.   If not able to get SN from list of MAC addresses then show error...
        var bRangeIssue = false; 
        if( guiNumDevicesFound == 0 )
        {
            if( uBtAutoTryCount < 3 )
            {
                uBtAutoTryCount++;
                PrintLog(1, "BT: Retry to find BT devices:  Try Count=" + uBtAutoTryCount );
                
                RestartSouthBoundIf(true, false);   // Restart clean without deleting MAC babbling list....
            }
            else
            {
                uBtAutoTryCount = 0;
                bRangeIssue = true;
            }
        }
        else if( guiNumDevicesFound >= 1 )
        {
            SpinnerStop();  // jdo added to stop spinner
            deviceFoundUIFlag = true;   // Keep the popup, "Can't find a booster" from showing up after 2 minutes
            
            
            
            if( bRangeIssue == false )
            {
                // If the 1 device found is a Skal and it does not have a valid GO pairing, i.e. guiDeviceSubCnxList[] not "Cnx",
                // then allow user to view and select.
                if( (guiDeviceTypeList[firstFoundIdx] == "Antenna")  && (guiDeviceSubCnxList[firstFoundIdx] != "Cnx") )
                {
                    PrintLog(1, "Skal:  Single device found which is a Skal but it is not connected to a GO so show user and allow to connect." );
 //                   guiDeviceFlag = true;   // Show popup with single Antenna device.
                }
                else
                {
                    guiDeviceFlag   = false;
                    btCnxIdIdx      = firstFoundIdx;
                    nxtyRxStatusIcd = icdDeviceList[btCnxIdIdx]; 
                    myLastBtAddress = guiDeviceMacAddrList[btCnxIdIdx];
                    if( isSouthBoundIfCnx == false )
                    {
                        ConnectBluetoothDevice(guiDeviceMacAddrList[btCnxIdIdx]);
                    }
                    isSouthBoundIfListDone = true;      // Main app loop must be placed on hold until true.
                    bMonitorBt = true;                  // Start monitoring the BT connection...
                    
                    
                    // Start the saftey check...
                    if( BluetoothCnxTimer == null )
                    {
                        BluetoothCnxTimer = setTimeout(BluetoothLoop, 10000);
                    }
                }
            }
        }
//        else if( guiNumDevicesFound > 1 )
//        {
//            guiDeviceFlag = true;
//            deviceFoundUIFlag = true;   // Keep the popup, "Can't find a booster" from showing up after 2 minutes
//        }
        
        if( bRangeIssue )
        {
//            util.showNoDeviceFoundErrorPopup(true);
            showAlert("WaveTools", "No device found.");
            
            //ShowAlertPopUpMsg( GetLangString("BluetoothRangeIssue"), GetLangString("BluetoothRangeIssueMsg") );
            guiDeviceFlag = false;
        }

        // Clean up...
        isNxtyStatusCurrent = false;
    }
}



// CnxAndIdentifySouthBoundDevice........................................................................
var cnxIdState       = 0;
var btCnxIdIdx       = -1;                          // Index into guiDeviceMacAddrList[] for final BT connection.  Used globally.
var cnxIdLoopCounter = 0;
function CnxAndIdentifySouthBoundDevice(devIdx)
{
    nxtyRxStatusIcd = icdDeviceList[devIdx];    
    PrintLog(1, "BT: CnxAndIdentifySouthBoundDevice("+ devIdx + ") = " + guiDeviceSnList[devIdx] + " ICD ver=0x" + nxtyRxStatusIcd.toString(16) );
    
    if( (isSouthBoundIfCnx == true) && (devIdx == btCnxIdIdx) )
    {
        // If we are already connected to the correct device then flash...
        FindMyCelfi();
    }
    else
    {
        // Start the disconnect and reconnect loop...
        cnxIdState       = 0;
        btCnxIdIdx       = devIdx;
        cnxIdLoopCounter = 0;
        setTimeout( CnxId, 100 );

        if( BluetoothCnxTimer != null )
        {
            clearTimeout(BluetoothCnxTimer);
            BluetoothCnxTimer = null;
        }

    }
}


// CnxId........................................................................
function CnxId()
{
    PrintLog(10, "BT: CnxId()... idx=" + btCnxIdIdx + " state=" + cnxIdState + " Counter=" + cnxIdLoopCounter );

    switch(cnxIdState)
    {
        // Disconnect if connected
        case 0:
        {
            if( isSouthBoundIfCnx == true )
            {
                DisconnectBluetoothDevice();
                cnxIdState = 1;
            }
            else
            {
                cnxIdState = 2;
            }

            break;
        }

        case 1:
        {
            if( isSouthBoundIfCnx == false )
            {
                cnxIdState = 2;
            }
            break;
        }

        // Connect to BT device
        case 2:
        {
            if( isSouthBoundIfCnx == false )
            {
                nxtyRxBtCnx = 0;
                ConnectBluetoothDevice(guiDeviceMacAddrList[btCnxIdIdx]);
//                BluetoothCnxTimer = setTimeout(BluetoothLoop, 10000);         // Moved to below.
                cnxIdState = 3;
            }
            break;
        }


        // Bug 1581: Delay FindMyCelfi().
        // Tx cnx msg is sent by BT chip to PIC when connected so PIC will toss any messages sent immediately from the Wave App.
        case 3:
        case 4:
        case 5:
        {
            if( isSouthBoundIfCnx )
            {
                cnxIdState++;

                if( nxtyRxBtCnx == 1 )
                {
                    // Jump immediately...
                    cnxIdState = 6;
                }
            }
            else
            {
                if( bBtTryingToCnx == false )
                {
                    // Auto retry to connect...
                    cnxIdState = 2;
                }
            }
            break;
        }


        // Wait until device connected then send flash command...
        case 6:
        {
            FindMyCelfi();
            BluetoothCnxTimer = setTimeout(BluetoothLoop, 10000);       // Only start loop if connected.
            bMonitorBt = true;                  // Start monitoring the BT connection...
            return;             // Exit stage left
            break;
        }

    }


    cnxIdLoopCounter++;

    // Safety exit...
    if( cnxIdLoopCounter < 50 )
    {
        // Come back in 250 mS
        setTimeout( CnxId, 250 );
    }
}



                                            


// HandlePhoneBackground........................................................................
function HandlePhoneBackground()
{
    PrintLog(1, "WaveTools sent to background, exiting..." );
//    navigator.app.exitApp();

/*
Not for WaveTools
    PrintLog(1, "Phone sent to background, disconnect BT after 5 minutes to save power.  " + Date());
    bPhoneInBackground = true;
    
    if( ShutDownBluetoothTimer == null )
    {
        ShutDownBluetoothTimer = setTimeout(ShutdownBluetoothInBackground, 5 * 60 * 1000);  // Turn off BT in 5 minutes...
    }
*/    
}

// HandlePhoneForeground........................................................................
function HandlePhoneForeground()
{

    PrintLog(1, "BT: Phone returned from background.  " + Date());
/*    
    bPhoneInBackground = false;

    if( ShutDownBluetoothTimer != null )
    {
        clearTimeout(ShutDownBluetoothTimer);
        ShutDownBluetoothTimer = null;   
    }
    
    if(bBtCnxWhenBackground)
    {
        RestartSouthBoundIf(false, false);     // Restart using last address.
        bBtCnxWhenBackground = false;
    }
*/    
}

// ShutdownBluetoothInBackground........................................................................
function ShutdownBluetoothInBackground()
{
    PrintLog(1, "BT: Phone in background for 5 minutes, disconnect BT to save power.  " + Date());
    ShutDownBluetoothTimer = null;   

    if( isSouthBoundIfCnx )
    {
        DisconnectAndStopSouthBoundIf();
        bBtCnxWhenBackground = true;
    }
}

