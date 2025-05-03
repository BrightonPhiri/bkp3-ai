#!/usr/bin/env python
"""
Script to delete all files under a specified size limit in a directory.
Usage: python delete_small_files.py [directory] [size_limit_kb]
"""

import os
import sys
from pathlib import Path


def delete_small_files(directory, size_limit_kb=5):
    """
    Delete all files under `size_limit_kb` KB in the given directory.
    
    Args:
        directory: Path to the directory to scan
        size_limit_kb: Size limit in kilobytes. Files smaller than this will be deleted.
    
    Returns:
        tuple: (deleted_count, total_size_freed)
    """
    directory_path = Path(directory)
    if not directory_path.exists() or not directory_path.is_dir():
        print(f"Error: {directory} is not a valid directory")
        return 0, 0
    
    # Convert KB to bytes
    size_limit_bytes = size_limit_kb * 1024
    
    deleted_count = 0
    total_size_freed = 0
    
    print(f"Scanning {directory} for files smaller than {size_limit_kb} KB...")
    
    # Walk through the directory and delete small files
    for root, dirs, files in os.walk(directory):
        for filename in files:
            filepath = Path(root) / filename
            
            try:
                # Get file size
                filesize = filepath.stat().st_size
                
                # Check if file is smaller than the size limit
                if filesize < size_limit_bytes:
                    print(f"Deleting {filepath} ({filesize} bytes)")
                    
                    # Delete the file
                    os.remove(filepath)
                    
                    # Update stats
                    deleted_count += 1
                    total_size_freed += filesize
            except Exception as e:
                print(f"Could not delete {filepath}: {e}")
    
    # Convert bytes freed to KB for display
    total_size_freed_kb = total_size_freed / 1024
    
    print(f"\nSummary:")
    print(f"- {deleted_count} files deleted")
    print(f"- {total_size_freed_kb:.2f} KB freed")
    
    return deleted_count, total_size_freed


def main():
    """Main function to handle command line arguments and run the script."""
    # Get directory from command line args, default to current directory
    directory = "."
    size_limit_kb = 5
    
    if len(sys.argv) > 1:
        directory = sys.argv[1]
    
    if len(sys.argv) > 2:
        try:
            size_limit_kb = float(sys.argv[2])
        except ValueError:
            print(f"Error: Size limit must be a number, got {sys.argv[2]}")
            return 1
    
    # Ask for confirmation before proceeding
    print(f"This will delete all files smaller than {size_limit_kb} KB in {directory}")
    confirmation = input("Do you want to proceed? (y/N): ")
    
    if confirmation.lower() != 'y':
        print("Operation cancelled.")
        return 0
    
    # Delete small files
    delete_small_files(directory, size_limit_kb)
    return 0


if __name__ == "__main__":
    sys.exit(main()) 