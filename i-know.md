### 总结一下
> 这个库是loader的执行器

### loaderLoader.js加载相应loader的实现入口
>提取了目标模块两个函数`defalut`和`pitch`，后面真正代码，其实是组织这两种函数的执行

### LoaderRunner.js执行loader
>围绕loader数组，本质是遍历执行了这个数组的，但是遍历的过程比较绕。`iteratePitchingLoaders`和`iterateNormalLoaders`实现了对loader两次遍历。`iteratePitchingLoaders`是从前到后顺序遍历执行`pitch`；`iterateNormalLoaders`从当前执行到的数组下标逆序执行。
- `runSyncOrAsync`这个函数支持执行同步、异步的函数；在执行函数时放在一个空函数里面`LOADER_EXECUTION`，不明白这样的必要性