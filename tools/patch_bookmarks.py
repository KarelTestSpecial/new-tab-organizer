import re

with open('js/bookmarks.js', 'r') as f:
    content = f.read()

# Replace the flawed move loop
old_loop = """              let moveChain = Promise.resolve();
              sortedChildren.forEach((node, index) => {
                  moveChain = moveChain.then(() => new Promise(resolve => {
                      if (node.index !== index) {
                          chrome.bookmarks.move(node.id, { parentId: folderId, index: index }, () => {
                              resolve();
                          });
                      } else {
                          resolve();
                      }
                  }));
              });"""

new_loop = """              // Use currentIds to track shifting indices safely
              let currentIds = children.map(c => c.id);
              let moveChain = Promise.resolve();
              sortedChildren.forEach((node, targetIndex) => {
                  moveChain = moveChain.then(() => new Promise(resolve => {
                      const currentIndex = currentIds.indexOf(node.id);
                      if (currentIndex !== targetIndex) {
                          currentIds.splice(currentIndex, 1);
                          currentIds.splice(targetIndex, 0, node.id);
                          chrome.bookmarks.move(node.id, { parentId: folderId, index: targetIndex }, () => {
                              resolve();
                          });
                      } else {
                          resolve();
                      }
                  }));
              });"""

# Wait, the code in bookmarks.js uses `parentId: nodeId` instead of `folderId`!
# Let me grep it exactly first to be sure!
