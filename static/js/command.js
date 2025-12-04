// Command Library - Categorized pre-defined commands
const COMMAND_LIBRARY = {
    'System Info': [
        { name: 'Who Am I', command: 'whoami', description: 'Current user' },
        { name: 'Hostname', command: 'hostname', description: 'Computer name' },
        { name: 'System Info', command: 'systeminfo', description: 'Detailed system information' },
        { name: 'OS Version', command: 'ver', description: 'Windows version' },
        { name: 'Computer Model', command: 'wmic computersystem get model,manufacturer', description: 'Hardware info' },
        { name: 'Uptime', command: 'wmic os get lastbootuptime', description: 'Last boot time' }
    ],
    'Network': [
        { name: 'IP Config', command: 'ipconfig', description: 'Network configuration' },
        { name: 'IP Config (Full)', command: 'ipconfig /all', description: 'Detailed network info' },
        { name: 'Ping Google', command: 'ping -n 4 google.com', description: 'Test internet connectivity' },
        { name: 'Network Stats', command: 'netstat -an', description: 'Active connections' },
        { name: 'ARP Table', command: 'arp -a', description: 'ARP cache' },
        { name: 'DNS Lookup', command: 'nslookup google.com', description: 'DNS resolution' },
        { name: 'Route Table', command: 'route print', description: 'Routing table' }
    ],
    'Processes': [
        { name: 'Task List', command: 'tasklist', description: 'Running processes' },
        { name: 'Task List (Detailed)', command: 'tasklist /v', description: 'Processes with details' },
        { name: 'Services', command: 'net start', description: 'Running services' },
        { name: 'Top Processes (PS)', command: 'powershell "Get-Process | Sort-Object CPU -Descending | Select-Object -First 10"', description: 'Top 10 CPU processes' }
    ],
    'Files & Folders': [
        { name: 'List Directory', command: 'dir', description: 'Current directory contents' },
        { name: 'List C:\\', command: 'dir C:\\', description: 'C drive root' },
        { name: 'Directory Tree', command: 'tree /F', description: 'Directory structure' },
        { name: 'Current Path', command: 'cd', description: 'Show current directory' },
        { name: 'Disk Space', command: 'wmic logicaldisk get name,size,freespace', description: 'Disk usage' }
    ],
    'Users & Security': [
        { name: 'List Users', command: 'net user', description: 'Local users' },
        { name: 'Administrators', command: 'net localgroup administrators', description: 'Admin group members' },
        { name: 'Current User Info', command: 'net user %username%', description: 'Current user details' },
        { name: 'Account Policies', command: 'net accounts', description: 'Password policies' },
        { name: 'Logged In Users', command: 'query user', description: 'Active sessions' }
    ],
    'System Control': [
        { name: 'Date & Time', command: 'date /t && time /t', description: 'Current date and time' },
        { name: 'Environment Vars', command: 'set', description: 'Environment variables' },
        { name: 'Installed Programs', command: 'wmic product get name,version', description: 'Software list' },
        { name: 'Startup Programs', command: 'wmic startup get caption,command', description: 'Auto-start programs' },
        { name: 'System Drivers', command: 'driverquery', description: 'Installed drivers' }
    ],
    'PowerShell': [
        { name: 'PS Version', command: 'powershell $PSVersionTable', description: 'PowerShell version' },
        { name: 'Computer Info', command: 'powershell Get-ComputerInfo', description: 'Detailed computer info' },
        { name: 'Disk Info', command: 'powershell Get-PSDrive -PSProvider FileSystem', description: 'Drive information' },
        { name: 'Network Adapters', command: 'powershell Get-NetAdapter', description: 'Network interfaces' },
        { name: 'Firewall Status', command: 'powershell Get-NetFirewallProfile', description: 'Firewall profiles' }
    ],
    'Custom': [
        { name: 'Echo Test', command: 'echo Hello from CNC!', description: 'Test command' },
        { name: 'System Beep', command: 'echo ', description: 'Beep sound' },
        { name: 'Clear Screen', command: 'cls', description: 'Clear console' }
    ]
};

// Get all category names
function getCommandCategories() {
    return Object.keys(COMMAND_LIBRARY);
}

// Get commands for a specific category
function getCommandsByCategory(category) {
    return COMMAND_LIBRARY[category] || [];
}

// Search commands by name or description
function searchCommands(query) {
    const results = [];
    const lowerQuery = query.toLowerCase();
    
    for (const [category, commands] of Object.entries(COMMAND_LIBRARY)) {
        for (const cmd of commands) {
            if (cmd.name.toLowerCase().includes(lowerQuery) || 
                cmd.description.toLowerCase().includes(lowerQuery) ||
                cmd.command.toLowerCase().includes(lowerQuery)) {
                results.push({ ...cmd, category });
            }
        }
    }
    
    return results;
}
