export const WIFI_DATA_ELEMENTS_KEY = 'Device.WiFi.DataElements.Network.Device.';
export const HOST_TABLE_KEY = 'Device.Hosts.Host.';
export const CONNECTED_DEVICE_COUNT_KEY = 'Device.Hosts.X_CISCO_COM_ConnectedDeviceNumber';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function parseInteger(value) {
  if (value == null || value === '') {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

function normalizeMac(value) {
  const normalized = normalizeString(value).toLowerCase();
  return normalized || '';
}

function isTruthy(value) {
  return normalizeString(value).toLowerCase() === 'true';
}

function getLastHexSuffix(value) {
  const hex = normalizeString(value).replace(/[^a-fA-F0-9]/g, '').toUpperCase();
  return hex.slice(-4) || 'NODE';
}

function getReportArray(reportData) {
  return Array.isArray(reportData?.Report) ? reportData.Report : [];
}

export function getTelemetryReportValue(reportData, key) {
  for (const entry of getReportArray(reportData)) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(entry, key)) {
      return entry[key];
    }
  }

  return null;
}

export function rcpiToDbm(value) {
  const parts = normalizeString(value)
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part && part.toUpperCase() !== 'NULL');

  if (!parts.length) {
    return '';
  }

  const numeric = parts
    .map((part) => Number.parseFloat(part))
    .filter((part) => Number.isFinite(part));

  if (!numeric.length) {
    return '';
  }

  const average = numeric.reduce((total, current) => total + current, 0) / numeric.length;
  const dbm = average / 2 - 110;
  return `${Math.round(dbm)} dBm`;
}

function countBssStas(bss) {
  const explicit = parseInteger(bss?.STANumberOfEntries);
  if (explicit != null) {
    return explicit;
  }

  return asArray(bss?.STA).length;
}

function buildHostRecords(hostTable) {
  return asArray(hostTable)
    .filter((host) => host && typeof host === 'object')
    .map((host) => ({
      index: normalizeString(host.index),
      mac: normalizeString(host.PhysAddress),
      normalizedMac: normalizeMac(host.PhysAddress),
      host_name: normalizeString(host.HostName),
      ip_address: normalizeString(host.IPAddress),
      active: isTruthy(host.Active),
      layer1_interface: normalizeString(host.Layer1Interface),
      layer3_interface: normalizeString(host.Layer3Interface),
      interface_type: normalizeString(host.InterfaceType),
      vendor_class_id: normalizeString(host.VendorClassID),
      lease_time_remaining: normalizeString(host.LeaseTimeRemaining),
      raw: host,
    }))
    .filter((host) => host.mac);
}

function shortMediaLabel(mediaType) {
  const value = normalizeString(mediaType);
  if (!value) {
    return 'WiFi';
  }

  if (/802\.11/i.test(value)) {
    return 'WiFi';
  }

  if (/ethernet/i.test(value)) {
    return 'Ethernet';
  }

  if (/mocha|moca/i.test(value)) {
    return 'MoCA';
  }

  return value.replace(/^IEEE\s+/i, '');
}

function sanitizeMermaidId(value) {
  const stripped = normalizeString(value).replace(/[^a-zA-Z0-9_]/g, '_');
  return stripped ? `n_${stripped}` : `n_${Math.random().toString(16).slice(2, 8)}`;
}

function escapeMermaidLabel(value) {
  return normalizeString(value).replace(/"/g, '\\"');
}

function buildClientRecord(sta, radio, bss, host) {
  const mac = normalizeString(sta?.MACAddress);
  if (!mac) {
    return null;
  }

  return {
    mac,
    normalized_mac: normalizeMac(mac),
    ssid: normalizeString(bss?.SSID),
    band: normalizeString(radio?.X_AIRTIES_OperatingFrequencyBand),
    operating_standard: normalizeString(sta?.X_AIRTIES_OperatingStandard),
    affiliated: isTruthy(sta?.X_AIRTIES_Affiliated),
    signal_strength: rcpiToDbm(sta?.SignalStrength),
    max_phy_rate: parseInteger(sta?.X_AIRTIES_MaxPhyRate),
    last_downlink_rate: parseInteger(sta?.LastDataDownlinkRate),
    last_uplink_rate: parseInteger(sta?.LastDataUplinkRate),
    bytes_received: parseInteger(sta?.BytesReceived),
    bytes_sent: parseInteger(sta?.BytesSent),
    last_connect_time: parseInteger(sta?.LastConnectTime),
    retrans_count: parseInteger(sta?.RetransCount),
    host_name: host?.host_name ?? '',
    ip_address: host?.ip_address ?? '',
    active: host?.active ?? false,
    interface_type: host?.interface_type ?? '',
    reconciliation: host ? 'matched' : 'dataelements-only',
    raw_sta: sta,
    raw_host: host?.raw ?? null,
  };
}

function buildNodeRecord(device, hostByMac) {
  const radios = asArray(device?.Radio);
  const backhaulPhyRate = parseInteger(device?.BackhaulPHYRate) ?? 0;
  const backhaulMacAddress = normalizeString(device?.BackhaulMACAddress);
  const backhaulStats = device?.MultiAPDevice?.Backhaul?.Stats ?? {};
  const nodeHost = hostByMac.get(normalizeMac(device?.ID)) ?? null;

  const parsedRadios = radios.map((radio) => {
    const bssEntries = asArray(radio?.BSS);
    const radioClients = [];
    let staCount = 0;

    for (const bss of bssEntries) {
      staCount += countBssStas(bss);

      if (!isTruthy(bss?.FronthaulUse)) {
        continue;
      }

      for (const sta of asArray(bss?.STA)) {
        const client = buildClientRecord(
          sta,
          radio,
          bss,
          hostByMac.get(normalizeMac(sta?.MACAddress)) ?? null,
        );
        if (client) {
          radioClients.push(client);
        }
      }
    }

    return {
      id: normalizeString(radio?.ID),
      band: normalizeString(radio?.X_AIRTIES_OperatingFrequencyBand),
      standards: normalizeString(radio?.X_AIRTIES_OperatingStandards),
      channel: normalizeString(radio?.X_AIRTIES_Channel),
      bandwidth: normalizeString(radio?.X_AIRTIES_Bandwidth),
      temperature: normalizeString(radio?.X_AIRTIES_Temperature),
      bss_count: parseInteger(radio?.BSSNumberOfEntries) ?? bssEntries.length,
      sta_count: staCount,
      bss: bssEntries.map((bss) => ({
        bssid: normalizeString(bss?.BSSID),
        ssid: normalizeString(bss?.SSID),
        fronthaul_use: isTruthy(bss?.FronthaulUse),
        backhaul_use: isTruthy(bss?.BackhaulUse),
      })),
      clients: radioClients,
    };
  });

  const clients = parsedRadios.flatMap((radio) => radio.clients);
  const connectedClients = parsedRadios.reduce((total, radio) => total + radio.sta_count, 0);

  return {
    id: normalizeString(device?.ID),
    index: normalizeString(device?.index),
    is_gateway:
      normalizeString(device?.index) === '1' ||
      (!backhaulMacAddress && backhaulPhyRate === 0),
    manufacturer: normalizeString(device?.Manufacturer),
    manufacturer_model: normalizeString(device?.ManufacturerModel),
    serial_number: normalizeString(device?.SerialNumber),
    software_version: normalizeString(device?.SoftwareVersion),
    host_record: nodeHost,
    backhaul_mac_address: backhaulMacAddress,
    backhaul_media_type: normalizeString(device?.BackhaulMediaType),
    backhaul_alid: normalizeString(device?.BackhaulALID),
    backhaul_phy_rate: backhaulPhyRate,
    backhaul_signal_strength: rcpiToDbm(backhaulStats?.SignalStrength),
    backhaul_link_utilization: parseInteger(backhaulStats?.LinkUtilization),
    memory_status: device?.X_AIRTIES_DeviceInfo?.MemoryStatus ?? null,
    process_status: device?.X_AIRTIES_DeviceInfo?.ProcessStatus ?? null,
    onboarded: normalizeString(device?.X_AIRTIES_Onboarded),
    service_active: normalizeString(device?.X_AIRTIES_ServiceActive),
    radios: parsedRadios,
    clients,
    connected_clients: connectedClients,
    raw: device,
  };
}

export function getWifiAnalysisTrees(report) {
  const data = report?.data ?? null;
  const wifiDevices = getTelemetryReportValue(data, WIFI_DATA_ELEMENTS_KEY);
  const hosts = getTelemetryReportValue(data, HOST_TABLE_KEY);
  const connectedDeviceNumber = report?.flatData?.[CONNECTED_DEVICE_COUNT_KEY] ?? '';

  return {
    wifiDevices: asArray(wifiDevices),
    hosts: asArray(hosts),
    connectedDeviceNumber: connectedDeviceNumber === '' ? '' : parseInteger(connectedDeviceNumber),
  };
}

function resolveParentId(node, idToNode, idLowerMap, bssidToDevice, gatewayNode) {
  const direct = normalizeString(node.backhaul_alid);
  if (direct && idToNode.has(direct)) {
    return direct;
  }

  const caseInsensitive = direct ? idLowerMap.get(direct.toLowerCase()) : null;
  if (caseInsensitive) {
    return caseInsensitive;
  }

  const backhaulOwner = node.backhaul_mac_address
    ? bssidToDevice.get(node.backhaul_mac_address.toLowerCase())
    : null;
  if (backhaulOwner && backhaulOwner !== node.id) {
    return backhaulOwner;
  }

  if (
    gatewayNode &&
    gatewayNode.id !== node.id &&
    (node.backhaul_mac_address || node.backhaul_phy_rate > 0 || node.backhaul_media_type)
  ) {
    return gatewayNode.id;
  }

  return '';
}

export function buildWifiTopologySnapshot(report) {
  const { wifiDevices, hosts, connectedDeviceNumber } = getWifiAnalysisTrees(report);
  if (!wifiDevices.length) {
    return null;
  }

  const hostRecords = buildHostRecords(hosts);
  const hostByMac = new Map(hostRecords.map((host) => [host.normalizedMac, host]));
  const nodes = wifiDevices
    .map((device) => buildNodeRecord(device, hostByMac))
    .filter((node) => node.id);

  const idToNode = new Map(nodes.map((node) => [node.id, node]));
  const idLowerMap = new Map(nodes.map((node) => [node.id.toLowerCase(), node.id]));
  const bssidToDevice = new Map();
  const matchedHostMacs = new Set();

  for (const node of nodes) {
    if (node.host_record?.normalizedMac) {
      matchedHostMacs.add(node.host_record.normalizedMac);
    }

    for (const client of node.clients) {
      if (client.reconciliation === 'matched') {
        matchedHostMacs.add(client.normalized_mac);
      }
    }

    for (const radio of node.radios) {
      for (const bss of radio.bss) {
        const normalizedBssid = normalizeMac(bss.bssid);
        if (normalizedBssid) {
          bssidToDevice.set(normalizedBssid, node.id);
        }
      }
    }
  }

  const gatewayNode = nodes.find((node) => node.is_gateway) ?? null;
  const edges = [];

  for (const node of nodes) {
    if (node.is_gateway) {
      continue;
    }

    const parentId = resolveParentId(node, idToNode, idLowerMap, bssidToDevice, gatewayNode);
    if (!parentId) {
      continue;
    }

    const mediaType = node.backhaul_media_type;
    const isWifi = !mediaType || /802\.11/i.test(mediaType);

    edges.push({
      from_id: parentId,
      to_id: node.id,
      media_type: mediaType,
      phy_rate: node.backhaul_phy_rate,
      signal_strength: node.backhaul_signal_strength,
      link_utilization: node.backhaul_link_utilization,
      is_wifi: isWifi,
    });
  }

  const unmatchedHosts = hostRecords.filter((host) => !matchedHostMacs.has(host.normalizedMac));
  const mermaid = buildMermaid(snapshotShape({
    report,
    nodes,
    edges,
    unmatchedHosts,
    connectedDeviceNumber,
  }));

  return snapshotShape({
    report,
    nodes,
    edges,
    unmatchedHosts,
    connectedDeviceNumber,
    mermaid,
  });
}

function snapshotShape({
  report,
  nodes,
  edges,
  unmatchedHosts,
  connectedDeviceNumber,
  mermaid = '',
}) {
  return {
    device_count: nodes.length,
    nodes,
    edges,
    unmatched_hosts: unmatchedHosts,
    matched_host_count: nodes.reduce(
      (total, node) =>
        total +
        (node.host_record ? 1 : 0) +
        node.clients.filter((client) => client.reconciliation === 'matched').length,
      0,
    ),
    dataelements_only_client_count: nodes.reduce(
      (total, node) =>
        total + node.clients.filter((client) => client.reconciliation === 'dataelements-only').length,
      0,
    ),
    host_table_count: unmatchedHosts.length,
    connected_device_number: connectedDeviceNumber,
    mermaid,
    time: report?.timestamp ?? null,
    log_timestamp: report?.rawTimestamp ?? '',
    profile: normalizeString(report?.flatData?.['Profile.Name']),
  };
}

function buildMermaid(snapshot) {
  const lines = ['flowchart LR'];

  for (const node of snapshot.nodes) {
    const mermaidId = sanitizeMermaidId(node.id);
    const role = node.is_gateway ? 'Gateway' : 'Extender';
    const model = escapeMermaidLabel(node.manufacturer_model || node.manufacturer || 'Unknown');
    const suffix = getLastHexSuffix(node.id);
    const label = `${role}<br/>${model}<br/>${suffix}`;

    if (node.is_gateway) {
      lines.push(`  ${mermaidId}("${label}")`);
    } else {
      lines.push(`  ${mermaidId}["${label}"]`);
    }
  }

  for (const edge of snapshot.edges) {
    const fromId = sanitizeMermaidId(edge.from_id);
    const toId = sanitizeMermaidId(edge.to_id);
    const mediaLabel = shortMediaLabel(edge.media_type);
    const phyRateLabel = edge.phy_rate ? ` ${edge.phy_rate} Mbps` : '';
    const label = escapeMermaidLabel(`${mediaLabel}${phyRateLabel}`.trim());

    if (edge.is_wifi) {
      lines.push(`  ${fromId} -. "${label}" .-> ${toId}`);
    } else {
      lines.push(`  ${fromId} -->|"${label}"| ${toId}`);
    }
  }

  for (const node of snapshot.nodes) {
    const ownerId = sanitizeMermaidId(node.id);

    for (const client of node.clients) {
      const clientId = sanitizeMermaidId(`client_${client.mac}`);
      const label = escapeMermaidLabel(client.host_name || getLastHexSuffix(client.mac));
      lines.push(`  ${clientId}(["${label}"])`);
      lines.push(`  ${ownerId} --> ${clientId}`);
    }
  }

  return lines.join('\n');
}

export function buildWifiTopologyTimeline(reports) {
  const snapshots = asArray(reports)
    .map((report) => buildWifiTopologySnapshot(report))
    .filter(Boolean)
    .sort((left, right) => {
      const leftTime = left.time instanceof Date ? left.time.getTime() : new Date(left.time ?? 0).getTime();
      const rightTime =
        right.time instanceof Date ? right.time.getTime() : new Date(right.time ?? 0).getTime();
      return leftTime - rightTime;
    });

  return {
    snapshots,
    total_snapshots: snapshots.length,
    time_range: {
      start: snapshots[0]?.time ?? null,
      end: snapshots[snapshots.length - 1]?.time ?? null,
    },
  };
}

function buildDepthMap(nodes, edges) {
  const incoming = new Map(nodes.map((node) => [node.id, 0]));
  const children = new Map(nodes.map((node) => [node.id, []]));

  for (const edge of edges) {
    incoming.set(edge.to_id, (incoming.get(edge.to_id) ?? 0) + 1);
    children.set(edge.from_id, [...(children.get(edge.from_id) ?? []), edge.to_id]);
  }

  const roots = nodes
    .filter((node) => node.is_gateway || (incoming.get(node.id) ?? 0) === 0)
    .sort((left, right) => left.id.localeCompare(right.id));

  const depthMap = new Map();
  const queue = roots.map((node) => ({ id: node.id, depth: 0 }));

  while (queue.length) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    const existing = depthMap.get(current.id);
    if (existing != null && existing <= current.depth) {
      continue;
    }

    depthMap.set(current.id, current.depth);
    for (const childId of children.get(current.id) ?? []) {
      queue.push({ id: childId, depth: current.depth + 1 });
    }
  }

  for (const node of nodes) {
    if (!depthMap.has(node.id)) {
      depthMap.set(node.id, 0);
    }
  }

  return depthMap;
}

export function buildTopologyLayout(
  snapshot,
  {
    nodeWidth = 260,
    levelGap = 140,
    verticalGap = 40,
    padding = 24,
    baseNodeHeight = 252,
    clientRowHeight = 68,
    overflowRowHeight = 28,
  } = {},
) {
  if (!snapshot?.nodes?.length) {
    return {
      width: 0,
      height: 0,
      positions: {},
    };
  }

  const depthMap = buildDepthMap(snapshot.nodes, snapshot.edges);
  const columns = new Map();

  for (const node of snapshot.nodes) {
    const depth = depthMap.get(node.id) ?? 0;
    const entries = columns.get(depth) ?? [];
    entries.push(node);
    columns.set(depth, entries);
  }

  const positions = {};
  const sortedDepths = [...columns.keys()].sort((left, right) => left - right);
  const columnHeights = new Map();

  for (const depth of sortedDepths) {
    const columnNodes = columns.get(depth)?.sort((left, right) => left.id.localeCompare(right.id)) ?? [];
    const totalHeight = columnNodes.reduce((total, node, index) => {
      const clientRows = Math.min(node.clients.length, 6);
      const overflowRow = node.clients.length > clientRows ? 1 : 0;
      const height = baseNodeHeight + clientRows * clientRowHeight + overflowRow * overflowRowHeight;
      return total + height + (index > 0 ? verticalGap : 0);
    }, 0);

    columnHeights.set(depth, totalHeight);
  }

  const canvasHeight = Math.max(
    padding * 2 + baseNodeHeight,
    ...[...columnHeights.values()].map((height) => height + padding * 2),
  );

  for (const depth of sortedDepths) {
    const columnNodes = columns.get(depth)?.sort((left, right) => left.id.localeCompare(right.id)) ?? [];
    const columnHeight = columnHeights.get(depth) ?? 0;
    let cursorY = Math.max(padding, (canvasHeight - columnHeight) / 2);

    for (const node of columnNodes) {
      const clientRows = Math.min(node.clients.length, 6);
      const overflowRow = node.clients.length > clientRows ? 1 : 0;
      const height = baseNodeHeight + clientRows * clientRowHeight + overflowRow * overflowRowHeight;

      positions[node.id] = {
        x: padding + depth * (nodeWidth + levelGap),
        y: cursorY,
        width: nodeWidth,
        height,
        centerX: padding + depth * (nodeWidth + levelGap) + nodeWidth / 2,
        centerY: cursorY + height / 2,
      };

      cursorY += height + verticalGap;
    }
  }

  return {
    width: padding * 2 + sortedDepths.length * nodeWidth + Math.max(0, sortedDepths.length - 1) * levelGap,
    height: canvasHeight,
    positions,
  };
}
