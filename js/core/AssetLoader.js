export class AssetLoader {
  constructor() {
    this.images = new Map();
    this.audio = new Map();
    
    // 我们在这个列表里定义好所有要加载的资源
    this.manifest = [
      // Shared
      { id: 'bomb', type: 'image', src: 'assets/tiles/shared/bomb.png' },
      { id: 'rocket', type: 'image', src: 'assets/tiles/shared/rocket.png' },
      { id: 'firecracker', type: 'image', src: 'assets/tiles/shared/firecracker.png' },
      { id: 'ice', type: 'image', src: 'assets/tiles/shared/ice.png' },
      // Garden
      { id: 'leaf', type: 'image', src: 'assets/tiles/garden/leaf.png' },
      { id: 'apple', type: 'image', src: 'assets/tiles/garden/apple.png' },
      { id: 'pear', type: 'image', src: 'assets/tiles/garden/pear.png' },
      { id: 'drop', type: 'image', src: 'assets/tiles/garden/drop.png' },
      { id: 'flower', type: 'image', src: 'assets/tiles/garden/flower.png' },
      { id: 'grass', type: 'image', src: 'assets/tiles/garden/grass.png' },
      { id: 'dynamite', type: 'image', src: 'assets/tiles/garden/dynamite.png' },
      { id: 'tnt', type: 'image', src: 'assets/tiles/garden/tnt.png' },
      // Home
      { id: 'book', type: 'image', src: 'assets/tiles/home/book.png' },
      { id: 'bowtie', type: 'image', src: 'assets/tiles/home/bowtie.png' },
      { id: 'lamp', type: 'image', src: 'assets/tiles/home/lamp.png' },
      { id: 'cup', type: 'image', src: 'assets/tiles/home/cup.png' },
      { id: 'cushion', type: 'image', src: 'assets/tiles/home/cushion.png' },
      { id: 'vase', type: 'image', src: 'assets/tiles/home/vase.png' },
      { id: 'paperplane', type: 'image', src: 'assets/tiles/home/paperplane.png' },
      { id: 'chain', type: 'image', src: 'assets/tiles/home/chain.png' },
      { id: 'jelly', type: 'image', src: 'assets/tiles/home/jelly.png' },
      { id: 'box', type: 'image', src: 'assets/tiles/home/box.png' },
    ];
  }

  /**
   * 按清单预加载所有资源
   * @param {Function} [onProgress] 进度回调 (0-1)
   * @returns {Promise} 加载完成时 resolve
   */
  loadAll(onProgress) {
    let loaded = 0;
    const total = this.manifest.length;

    return new Promise((resolve, reject) => {
      if (total === 0) {
        resolve();
        return;
      }

      this.manifest.forEach(item => {
        if (item.type === 'image') {
          const img = new Image();
          img.onload = () => {
            this.images.set(item.id, img);
            loaded++;
            if (onProgress) onProgress(loaded / total);
            if (loaded === total) resolve();
          };
          img.onerror = () => {
            console.warn(`Failed to load asset: ${item.src}`);
            // 出错也让进度走完，不阻断游戏运行
            loaded++;
            if (loaded === total) resolve();
          };
          img.src = item.src;
        }
      });
    });
  }

  /**
   * 获取加载后的图片对象
   * @param {string} id 
   * @returns {HTMLImageElement|null}
   */
  getImage(id) {
    return this.images.get(id) || null;
  }
}

// 导出一个单例全局可访问的 Asset 容器
export const Assets = new AssetLoader();
