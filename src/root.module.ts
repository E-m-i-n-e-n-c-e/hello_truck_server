/**
 * RootModule - Dynamic module loader based on APP_MODE
 *
 * This module determines which application to load based on the APP_MODE environment variable:
 * - APP_MODE=app    → Loads AppModule (customer/driver mobile app backend)
 * - APP_MODE=admin  → Loads AdminPortalModule (admin web portal backend)
 * - APP_MODE=all    → Loads both (for local development only)
 *
 * Default: 'app' (maintains backward compatibility)
 */
import { DynamicModule, Module, Type } from '@nestjs/common';
import { AppModule } from './app.module';
import { AdminPortalModule } from './admin-portal/admin-portal.module';

export type AppMode = 'app' | 'admin' | 'all';

function getAppMode(): AppMode {
  const mode = process.env.APP_MODE?.toLowerCase() as AppMode | undefined;

  if (mode && ['app', 'admin', 'all'].includes(mode)) {
    return mode;
  }

  // Default to 'app' for backward compatibility
  return 'app';
}

function getModulesToImport(mode: AppMode): Type<any>[] {
  switch (mode) {
    case 'admin':
      return [AdminPortalModule];
    case 'all':
      return [AppModule, AdminPortalModule];
    case 'app':
    default:
      return [AppModule];
  }
}

@Module({})
export class RootModule {
  static forRoot(): DynamicModule {
    const mode = getAppMode();
    const modules = getModulesToImport(mode);

    console.log(`\n🚀 Starting in ${mode.toUpperCase()} mode`);
    console.log(`   Loaded modules: ${modules.map(m => m.name).join(', ')}\n`);

    return {
      module: RootModule,
      imports: modules,
    };
  }
}
