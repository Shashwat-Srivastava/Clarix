import { describe, expect, it } from 'vitest';
import {
  buildTopologyLayout,
  buildWifiTopologySnapshot,
  buildWifiTopologyTimeline,
  rcpiToDbm,
} from './topology-utils.js';

function createReport({ time, profileName, wifiDevices, hosts, connectedDeviceNumber }) {
  return {
    timestamp: new Date(time),
    rawTimestamp: time.replace('T', ' ').replace('Z', ''),
    flatData: {
      'Profile.Name': profileName,
      ...(connectedDeviceNumber != null
        ? { 'Device.Hosts.X_CISCO_COM_ConnectedDeviceNumber': String(connectedDeviceNumber) }
        : {}),
    },
    data: {
      Report: [
        { Time: time.replace('T', ' ').replace('Z', '') },
        { 'Profile.Name': profileName },
        { 'Device.Hosts.Host.': hosts },
        { 'Device.WiFi.DataElements.Network.Device.': wifiDevices },
      ],
    },
  };
}

describe('topology-utils', () => {
  it('converts semicolon-separated RCPI values into dBm', () => {
    expect(rcpiToDbm('160;162;NULL;158')).toBe('-30 dBm');
    expect(rcpiToDbm('NULL;;')).toBe('');
  });

  it('builds a topology snapshot with host enrichment and WiFi backhaul inference', () => {
    const snapshot = buildWifiTopologySnapshot(
      createReport({
        time: '2026-03-08T23:03:14Z',
        profileName: 'advance',
        connectedDeviceNumber: 7,
        hosts: [
          {
            index: '1',
            PhysAddress: 'aa:aa:aa:aa:aa:aa',
            HostName: 'mesh-gateway',
            IPAddress: '192.168.1.1',
            Active: 'true',
          },
          {
            index: '2',
            PhysAddress: '11:22:33:44:55:66',
            HostName: 'phone',
            IPAddress: '192.168.1.50',
            Active: 'true',
            InterfaceType: 'Wi-Fi',
          },
          {
            index: '3',
            PhysAddress: 'ff:ee:dd:cc:bb:aa',
            HostName: 'host-only-client',
            IPAddress: '192.168.1.90',
            Active: 'false',
            InterfaceType: 'Wi-Fi',
          },
        ],
        wifiDevices: [
          {
            index: '1',
            ID: 'aa:aa:aa:aa:aa:aa',
            Manufacturer: 'Arcadyan',
            ManufacturerModel: 'Gateway',
            BackhaulPHYRate: '0',
            MultiAPDevice: {
              Backhaul: {
                Stats: {
                  SignalStrength: '0',
                  LinkUtilization: '0',
                },
              },
            },
            Radio: [
              {
                index: '1',
                ID: 'radio-gw',
                X_AIRTIES_OperatingFrequencyBand: '5GHz',
                X_AIRTIES_Channel: '36',
                X_AIRTIES_Bandwidth: '80MHz',
                BSS: [
                  {
                    index: '1',
                    BSSID: 'aa:aa:aa:aa:aa:01',
                    SSID: 'Mesh Backhaul',
                    BackhaulUse: 'true',
                    FronthaulUse: 'false',
                    STANumberOfEntries: '0',
                  },
                  {
                    index: '2',
                    BSSID: 'aa:aa:aa:aa:aa:02',
                    SSID: 'Home WiFi',
                    BackhaulUse: 'false',
                    FronthaulUse: 'true',
                    STANumberOfEntries: '1',
                    STA: [
                      {
                        index: '1',
                        MACAddress: '11:22:33:44:55:66',
                        SignalStrength: '160;162;158',
                        X_AIRTIES_MaxPhyRate: '1200',
                        LastDataDownlinkRate: '700',
                        LastDataUplinkRate: '300',
                        BytesReceived: '1000',
                        BytesSent: '2000',
                        LastConnectTime: '30',
                        RetransCount: '5',
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            index: '2',
            ID: 'bb:bb:bb:bb:bb:bb',
            Manufacturer: 'Arcadyan',
            ManufacturerModel: 'Extender',
            BackhaulMACAddress: 'aa:aa:aa:aa:aa:01',
            BackhaulMediaType: 'IEEE 802.11ax',
            BackhaulPHYRate: '1440',
            MultiAPDevice: {
              Backhaul: {
                Stats: {
                  SignalStrength: '150;152;154',
                  LinkUtilization: '13',
                },
              },
            },
            Radio: [
              {
                index: '1',
                ID: 'radio-ext',
                X_AIRTIES_OperatingFrequencyBand: '5GHz',
                X_AIRTIES_Channel: '100',
                X_AIRTIES_Bandwidth: '160MHz',
                BSS: [
                  {
                    index: '1',
                    BSSID: 'bb:bb:bb:bb:bb:01',
                    SSID: 'Extender WiFi',
                    BackhaulUse: 'false',
                    FronthaulUse: 'true',
                    STANumberOfEntries: '0',
                  },
                ],
              },
            ],
          },
        ],
      }),
    );

    expect(snapshot?.device_count).toBe(2);
    expect(snapshot?.edges).toEqual([
      {
        from_id: 'aa:aa:aa:aa:aa:aa',
        to_id: 'bb:bb:bb:bb:bb:bb',
        media_type: 'IEEE 802.11ax',
        phy_rate: 1440,
        signal_strength: '-34 dBm',
        link_utilization: 13,
        is_wifi: true,
      },
    ]);

    expect(snapshot?.nodes[0].host_record?.host_name).toBe('mesh-gateway');
    expect(snapshot?.nodes[0].clients).toHaveLength(1);
    expect(snapshot?.nodes[0].clients[0]).toMatchObject({
      mac: '11:22:33:44:55:66',
      host_name: 'phone',
      ip_address: '192.168.1.50',
      signal_strength: '-30 dBm',
      reconciliation: 'matched',
    });

    expect(snapshot?.unmatched_hosts).toHaveLength(1);
    expect(snapshot?.unmatched_hosts[0].host_name).toBe('host-only-client');
    expect(snapshot?.connected_device_number).toBe(7);
    expect(snapshot?.mermaid).toContain('flowchart LR');
    expect(snapshot?.mermaid).toContain('WiFi 1440 Mbps');
  });

  it('builds a sorted report timeline and a stable diagram layout', () => {
    const older = createReport({
      time: '2026-03-08T23:03:14Z',
      profileName: 'advance',
      hosts: [],
      wifiDevices: [{ index: '1', ID: 'aa:aa:aa:aa:aa:aa', BackhaulPHYRate: '0', Radio: [] }],
    });
    const newer = createReport({
      time: '2026-03-09T23:03:14Z',
      profileName: 'advance',
      hosts: [],
      wifiDevices: [
        { index: '1', ID: 'aa:aa:aa:aa:aa:aa', BackhaulPHYRate: '0', Radio: [] },
        {
          index: '2',
          ID: 'bb:bb:bb:bb:bb:bb',
          BackhaulMACAddress: 'aa:aa:aa:aa:aa:01',
          BackhaulPHYRate: '866',
          Radio: [{ index: '1', BSS: [{ index: '1', BSSID: 'aa:aa:aa:aa:aa:01' }] }],
        },
      ],
    });

    const timeline = buildWifiTopologyTimeline([newer, older]);
    expect(timeline.total_snapshots).toBe(2);
    expect(timeline.snapshots[0].log_timestamp).toBe('2026-03-08 23:03:14');
    expect(timeline.snapshots[1].log_timestamp).toBe('2026-03-09 23:03:14');

    const layout = buildTopologyLayout(timeline.snapshots[1]);
    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);
    expect(layout.positions['aa:aa:aa:aa:aa:aa']).toBeTruthy();
    expect(layout.positions['bb:bb:bb:bb:bb:bb']).toBeTruthy();
  });
});
