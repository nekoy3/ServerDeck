#!/usr/bin/env python3
"""
Flask Session Manager
=====================

Flask sessionファイルの管理とSSHマルチタブ状態の永続化を担当するモジュール

機能:
- 期限切れセッションファイルの自動削除
- SSHマルチタブ状態の保存・復元
- セッション統計情報の提供
"""

import os
import pickle
import time
import json
import threading
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import logging

# ログ設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SessionManager:
    """Flask sessionとSSHマルチタブ状態を管理するクラス"""
    
    def __init__(self, session_dir: str = "config/flask_session", cleanup_interval: int = 3600):
        """
        SessionManagerを初期化
        
        Args:
            session_dir: Flask sessionファイルが保存されているディレクトリ
            cleanup_interval: 自動クリーンアップの間隔（秒）
        """
        self.session_dir = session_dir
        self.cleanup_interval = cleanup_interval
        self.cleanup_thread = None
        self.running = False
        
        # SSHマルチタブ状態保存用
        self.ssh_tabs_file = os.path.join(session_dir, "ssh_tabs_state.json")
        
        # ディレクトリ作成
        os.makedirs(session_dir, exist_ok=True)
    
    def start_cleanup_service(self):
        """セッションクリーンアップサービスを開始"""
        if self.running:
            return
            
        self.running = True
        self.cleanup_thread = threading.Thread(target=self._cleanup_loop, daemon=True)
        self.cleanup_thread.start()
        logger.info(f"Session cleanup service started with {self.cleanup_interval}s interval")
    
    def stop_cleanup_service(self):
        """セッションクリーンアップサービスを停止"""
        self.running = False
        if self.cleanup_thread:
            self.cleanup_thread.join(timeout=5)
        logger.info("Session cleanup service stopped")
    
    def _cleanup_loop(self):
        """バックグラウンドでセッションクリーンアップを実行"""
        while self.running:
            try:
                self.cleanup_expired_sessions()
                time.sleep(self.cleanup_interval)
            except Exception as e:
                logger.error(f"Error in session cleanup loop: {e}")
                time.sleep(60)  # エラー時は1分待ってリトライ
    
    def cleanup_expired_sessions(self, max_age_hours: int = 24) -> Tuple[int, int]:
        """
        期限切れのセッションファイルを削除
        
        Args:
            max_age_hours: セッションファイルの最大保持時間（時間）
            
        Returns:
            Tuple[削除されたファイル数, 残存ファイル数]
        """
        if not os.path.exists(self.session_dir):
            return 0, 0
        
        current_time = time.time()
        max_age_seconds = max_age_hours * 3600
        deleted_count = 0
        remaining_count = 0
        
        try:
            for filename in os.listdir(self.session_dir):
                filepath = os.path.join(self.session_dir, filename)
                
                # 特別なファイルはスキップ
                if filename in ["ssh_tabs_state.json"] or filename.startswith("tmp"):
                    remaining_count += 1
                    continue
                
                try:
                    # ファイルの最終更新時刻を確認
                    file_mtime = os.path.getmtime(filepath)
                    file_age = current_time - file_mtime
                    
                    if file_age > max_age_seconds:
                        # 期限切れファイルを削除
                        os.remove(filepath)
                        deleted_count += 1
                        logger.debug(f"Deleted expired session file: {filename} (age: {file_age/3600:.1f}h)")
                    else:
                        remaining_count += 1
                        
                except (OSError, IOError) as e:
                    logger.warning(f"Could not process session file {filename}: {e}")
                    remaining_count += 1
                    
        except Exception as e:
            logger.error(f"Error during session cleanup: {e}")
        
        if deleted_count > 0:
            logger.info(f"Session cleanup completed: {deleted_count} expired files deleted, {remaining_count} files remaining")
        
        return deleted_count, remaining_count
    
    def get_session_stats(self) -> Dict:
        """セッション統計情報を取得"""
        if not os.path.exists(self.session_dir):
            return {"total_files": 0, "total_size": 0, "oldest_file": None, "newest_file": None}
        
        stats = {
            "total_files": 0,
            "total_size": 0,
            "oldest_file": None,
            "newest_file": None,
            "files_by_age": {"<1h": 0, "1-6h": 0, "6-24h": 0, ">24h": 0}
        }
        
        current_time = time.time()
        oldest_time = None
        newest_time = None
        
        try:
            for filename in os.listdir(self.session_dir):
                filepath = os.path.join(self.session_dir, filename)
                
                if filename.startswith("tmp") or filename == "ssh_tabs_state.json":
                    continue
                
                try:
                    file_stat = os.stat(filepath)
                    file_mtime = file_stat.st_mtime
                    file_size = file_stat.st_size
                    file_age_hours = (current_time - file_mtime) / 3600
                    
                    stats["total_files"] += 1
                    stats["total_size"] += file_size
                    
                    # 年齢別分類
                    if file_age_hours < 1:
                        stats["files_by_age"]["<1h"] += 1
                    elif file_age_hours < 6:
                        stats["files_by_age"]["1-6h"] += 1
                    elif file_age_hours < 24:
                        stats["files_by_age"]["6-24h"] += 1
                    else:
                        stats["files_by_age"][">24h"] += 1
                    
                    # 最古・最新ファイル
                    if oldest_time is None or file_mtime < oldest_time:
                        oldest_time = file_mtime
                        stats["oldest_file"] = {
                            "name": filename,
                            "age_hours": file_age_hours,
                            "modified": datetime.fromtimestamp(file_mtime).strftime("%Y-%m-%d %H:%M:%S")
                        }
                    
                    if newest_time is None or file_mtime > newest_time:
                        newest_time = file_mtime
                        stats["newest_file"] = {
                            "name": filename,
                            "age_hours": file_age_hours,
                            "modified": datetime.fromtimestamp(file_mtime).strftime("%Y-%m-%d %H:%M:%S")
                        }
                        
                except (OSError, IOError) as e:
                    logger.warning(f"Could not stat session file {filename}: {e}")
                    
        except Exception as e:
            logger.error(f"Error collecting session stats: {e}")
        
        return stats
    
    def save_ssh_tabs_state(self, session_id: str, tabs_data: List[Dict]):
        """
        SSHマルチタブの状態をセッションに保存
        
        Args:
            session_id: セッションID
            tabs_data: タブ情報のリスト
                [{"server_id": "server1", "server_name": "Server 1", "connected": True}, ...]
        """
        try:
            # 既存のデータを読み込み
            ssh_tabs_data = self.load_all_ssh_tabs_state()
            
            # 現在のセッションのデータを更新
            ssh_tabs_data[session_id] = {
                "tabs": tabs_data,
                "last_updated": datetime.now().isoformat(),
                "session_id": session_id
            }
            
            # ファイルに保存
            with open(self.ssh_tabs_file, 'w', encoding='utf-8') as f:
                json.dump(ssh_tabs_data, f, ensure_ascii=False, indent=2)
            
            logger.debug(f"SSH tabs state saved for session {session_id}: {len(tabs_data)} tabs")
            
        except Exception as e:
            logger.error(f"Error saving SSH tabs state: {e}")
    
    def load_ssh_tabs_state(self, session_id: str) -> List[Dict]:
        """
        セッションIDに対応するSSHマルチタブの状態を読み込み
        
        Args:
            session_id: セッションID
            
        Returns:
            タブ情報のリスト
        """
        try:
            ssh_tabs_data = self.load_all_ssh_tabs_state()
            session_data = ssh_tabs_data.get(session_id, {})
            
            if session_data:
                logger.debug(f"SSH tabs state loaded for session {session_id}: {len(session_data.get('tabs', []))} tabs")
                return session_data.get('tabs', [])
            
        except Exception as e:
            logger.error(f"Error loading SSH tabs state: {e}")
        
        return []
    
    def load_all_ssh_tabs_state(self) -> Dict:
        """すべてのSSHタブ状態データを読み込み"""
        if not os.path.exists(self.ssh_tabs_file):
            return {}
        
        try:
            with open(self.ssh_tabs_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            logger.warning(f"Could not load SSH tabs state file: {e}")
            return {}
    
    def cleanup_ssh_tabs_state(self, max_age_days: int = 7):
        """
        古いSSHタブ状態データを削除
        
        Args:
            max_age_days: 保持する最大日数
        """
        try:
            ssh_tabs_data = self.load_all_ssh_tabs_state()
            current_time = datetime.now()
            cutoff_time = current_time - timedelta(days=max_age_days)
            
            cleaned_data = {}
            removed_count = 0
            
            for session_id, session_data in ssh_tabs_data.items():
                try:
                    last_updated_str = session_data.get('last_updated')
                    if last_updated_str:
                        last_updated = datetime.fromisoformat(last_updated_str)
                        if last_updated > cutoff_time:
                            cleaned_data[session_id] = session_data
                        else:
                            removed_count += 1
                    else:
                        # last_updatedがない古いデータは削除
                        removed_count += 1
                except Exception as e:
                    logger.warning(f"Error processing SSH tabs state for session {session_id}: {e}")
                    removed_count += 1
            
            # クリーンアップしたデータを保存
            if removed_count > 0:
                with open(self.ssh_tabs_file, 'w', encoding='utf-8') as f:
                    json.dump(cleaned_data, f, ensure_ascii=False, indent=2)
                logger.info(f"SSH tabs state cleanup: {removed_count} old entries removed")
            
        except Exception as e:
            logger.error(f"Error during SSH tabs state cleanup: {e}")


# グローバルインスタンス
session_manager = SessionManager()

def initialize_session_manager(app):
    """Flaskアプリケーションでセッションマネージャーを初期化"""
    global session_manager
    
    # アプリケーション設定から値を取得
    session_dir = app.config.get('SESSION_FILE_DIR', 'config/flask_session')
    cleanup_interval = app.config.get('SESSION_CLEANUP_INTERVAL', 3600)  # 1時間
    
    session_manager = SessionManager(session_dir, cleanup_interval)
    session_manager.start_cleanup_service()
    
    # アプリケーション終了時にクリーンアップサービスを停止
    import atexit
    atexit.register(session_manager.stop_cleanup_service)
    
    logger.info("Session manager initialized")

def get_session_manager() -> SessionManager:
    """セッションマネージャーのインスタンスを取得"""
    return session_manager
