#!/bin/bash
# Checks for swap file and creates one if it doesn't exist.
# This helps prevent out-of-memory errors during build processes on low-memory servers.

SWAPFILE=/swapfile

if [ -f "$SWAPFILE" ]; then
    echo "Swap file $SWAPFILE already exists."
else
    echo "Creating 1GB swap file at $SWAPFILE..."
    # fallocate is faster than dd
    sudo fallocate -l 1G $SWAPFILE || sudo dd if=/dev/zero of=$SWAPFILE bs=1M count=1024

    sudo chmod 600 $SWAPFILE
    sudo mkswap $SWAPFILE
    sudo swapon $SWAPFILE
    echo "Swap file created and enabled."

    # Add to fstab to persist across reboots
    if ! grep -q "$SWAPFILE" /etc/fstab; then
        echo "$SWAPFILE none swap sw 0 0" | sudo tee -a /etc/fstab
        echo "Added to /etc/fstab."
    fi
fi

# Display current swap status
echo "Current swap status:"
sudo swapon --show
free -h
