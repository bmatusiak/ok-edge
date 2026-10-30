/*
 * ONE PLUGIN PER CHANNEL (src/plugins/types.ts AppChannel): it adds its status icon and its Activity card to the registry,
 * and its watch when it has one. Which channels a platform has is its list (src/features/list.*.ts).
 */
import type {AppChannel, AppWatch} from '../../plugins/types';
import type {TabsService} from '../../plugins/tabs';

type Register = (err: Error | null, services: Record<string, unknown>) => void;

export function channelPlugin(channel: AppChannel, watch?: AppWatch) {
  const setup = (imports: {tabs: TabsService}, register: Register) => {
    imports.tabs.channel(channel);
    if (watch) imports.tabs.watch(watch);
    register(null, {[`channel:${channel.name}`]: {}});
  };
  setup.consumes = ['tabs'];
  setup.provides = [`channel:${channel.name}`];
  return setup;
}
