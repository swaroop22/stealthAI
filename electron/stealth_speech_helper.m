#import <Foundation/Foundation.h>
#import <AVFoundation/AVFoundation.h>
#import <Speech/Speech.h>

@interface StealthSpeechEngine : NSObject <SFSpeechRecognizerDelegate>
@property (nonatomic, strong) SFSpeechRecognizer *recognizer;
@property (nonatomic, strong) AVAudioEngine *audioEngine;
@property (nonatomic, strong) SFSpeechAudioBufferRecognitionRequest *currentRequest;
@property (nonatomic, strong) SFSpeechRecognitionTask *currentTask;
@property (nonatomic, strong) NSMutableArray<AVAudioPCMBuffer *> *pendingBuffers;
@property (nonatomic, assign) BOOL isRunning;
@property (nonatomic, assign) BOOL isTransitioning;
@property (nonatomic, strong) NSString *lastEmittedInterim;
@property (nonatomic, assign) NSUInteger committedLength;
@property (nonatomic, strong) NSTimer *silenceTimer;
@property (nonatomic, strong) NSDate *taskStartTime;
@end

static StealthSpeechEngine *globalEngine = nil;

@implementation StealthSpeechEngine

- (instancetype)init {
    self = [super init];
    if (self) {
        NSLocale *locale = [NSLocale localeWithLocaleIdentifier:@"en-US"];
        self.recognizer = [[SFSpeechRecognizer alloc] initWithLocale:locale];
        self.recognizer.delegate = self;
        self.audioEngine = [[AVAudioEngine alloc] init];
        self.pendingBuffers = [NSMutableArray array];
        self.isRunning = NO;
        self.isTransitioning = NO;
        self.lastEmittedInterim = @"";
        self.committedLength = 0;
    }
    return self;
}

- (void)emitJSON:(NSDictionary *)dict {
    NSData *data = [NSJSONSerialization dataWithJSONObject:dict options:0 error:nil];
    if (data) {
        NSString *str = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
        printf("%s\n", [str UTF8String]);
        fflush(stdout);
    }
}

- (void)start {
    if (self.isRunning) return;
    self.isRunning = YES;

    [self emitJSON:@{@"type": @"status", @"message": @"starting"}];
    [self setupAndStartAudio];
}

- (void)setupAndStartAudio {
    @try {
        AVAudioInputNode *inputNode = self.audioEngine.inputNode;
        AVAudioFormat *recordingFormat = [inputNode outputFormatForBus:0];

        [inputNode removeTapOnBus:0];

        __weak typeof(self) weakSelf = self;
        [inputNode installTapOnBus:0 bufferSize:1024 format:recordingFormat block:^(AVAudioPCMBuffer * _Nonnull buffer, AVAudioTime * _Nonnull when) {
            __strong typeof(weakSelf) strongSelf = weakSelf;
            if (!strongSelf || !strongSelf.isRunning) return;

            @synchronized (strongSelf) {
                if (strongSelf.currentRequest) {
                    [strongSelf.currentRequest appendAudioPCMBuffer:buffer];
                } else {
                    // Buffer during task transition so no speech samples are dropped
                    if (strongSelf.pendingBuffers.count < 80) {
                        [strongSelf.pendingBuffers addObject:buffer];
                    }
                }
            }
        }];

        NSError *error = nil;
        [self.audioEngine startAndReturnError:&error];
        if (error) {
            [self emitJSON:@{@"type": @"error", @"message": [NSString stringWithFormat:@"Audio Engine error: %@", error.localizedDescription]}];
            return;
        }

        [self emitJSON:@{@"type": @"status", @"message": @"listening"}];
        [self startNewRecognitionTask];
    } @catch (NSException *exception) {
        [self emitJSON:@{@"type": @"error", @"message": exception.reason ?: @"Audio Engine exception"}];
    }
}

- (void)startNewRecognitionTask {
    if (!self.isRunning) return;

    self.isTransitioning = YES;

    [self.silenceTimer invalidate];
    self.silenceTimer = nil;

    // Clean up old task safely without triggering recursive cancel error
    if (self.currentTask) {
        SFSpeechRecognitionTask *oldTask = self.currentTask;
        self.currentTask = nil;
        [oldTask cancel];
    }

    if (self.currentRequest) {
        SFSpeechAudioBufferRecognitionRequest *oldReq = self.currentRequest;
        @synchronized (self) {
            self.currentRequest = nil;
        }
        [oldReq endAudio];
    }

    self.committedLength = 0;
    self.lastEmittedInterim = @"";
    self.taskStartTime = [NSDate date];

    SFSpeechAudioBufferRecognitionRequest *newRequest = [[SFSpeechAudioBufferRecognitionRequest alloc] init];
    newRequest.shouldReportPartialResults = YES;
    newRequest.taskHint = SFSpeechRecognitionTaskHintDictation;

    if (@available(macOS 13.0, *)) {
        newRequest.addsPunctuation = YES;
    }

    // Technical vocabulary hints for software engineering interviews
    newRequest.contextualStrings = @[
        @"API", @"HTTP", @"HTTPS", @"TCP", @"UDP", @"DNS", @"Postgres", @"PostgreSQL",
        @"Redis", @"Kafka", @"Docker", @"Kubernetes", @"AWS", @"GCP", @"Azure",
        @"microservices", @"architecture", @"concurrency", @"multithreading",
        @"cache", @"latency", @"throughput", @"database", @"SQL", @"NoSQL",
        @"React", @"TypeScript", @"JavaScript", @"Python", @"golang", @"GraphQL",
        @"load balancer", @"sharding", @"replication", @"hash map", @"binary tree"
    ];

    @synchronized (self) {
        self.currentRequest = newRequest;
        // Flush all audio buffered during transition
        for (AVAudioPCMBuffer *buf in self.pendingBuffers) {
            [newRequest appendAudioPCMBuffer:buf];
        }
        [self.pendingBuffers removeAllObjects];
    }

    __weak typeof(self) weakSelf = self;
    self.currentTask = [self.recognizer recognitionTaskWithRequest:newRequest resultHandler:^(SFSpeechRecognitionResult * _Nullable result, NSError * _Nullable taskError) {
        __strong typeof(weakSelf) strongSelf = weakSelf;
        if (!strongSelf || !strongSelf.isRunning) return;

        if (result) {
            NSString *fullTranscript = result.bestTranscription.formattedString;
            if (fullTranscript.length > 0) {
                NSString *turnText = @"";
                if (fullTranscript.length > strongSelf.committedLength) {
                    turnText = [fullTranscript substringFromIndex:strongSelf.committedLength];
                    NSCharacterSet *trimSet = [NSCharacterSet characterSetWithCharactersInString:@" \t\r\n.,!?;:-"];
                    turnText = [turnText stringByTrimmingCharactersInSet:trimSet];
                } else if (fullTranscript.length < strongSelf.committedLength) {
                    strongSelf.committedLength = 0;
                    turnText = fullTranscript;
                }

                if (turnText.length > 0) {
                    strongSelf.lastEmittedInterim = turnText;
                    [strongSelf emitJSON:@{
                        @"type": @"interim",
                        @"text": turnText
                    }];

                    // Natural pause timer: finalize turn after 2.5s of silence
                    [strongSelf.silenceTimer invalidate];
                    strongSelf.silenceTimer = [NSTimer scheduledTimerWithTimeInterval:2.5 repeats:NO block:^(NSTimer * _Nonnull timer) {
                        __strong typeof(weakSelf) sSelf = weakSelf;
                        if (!sSelf || !sSelf.isRunning) return;

                        NSString *finalText = [sSelf.lastEmittedInterim stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
                        if (finalText.length > 0) {
                            [sSelf emitJSON:@{
                                @"type": @"final",
                                @"text": finalText
                            }];
                            sSelf.committedLength = fullTranscript.length;
                            sSelf.lastEmittedInterim = @"";

                            // If task has run for > 45 seconds, refresh cleanly during this pause
                            NSTimeInterval elapsed = [[NSDate date] timeIntervalSinceDate:sSelf.taskStartTime];
                            if (elapsed > 45.0) {
                                [sSelf refreshTaskCleanly];
                            }
                        }
                    }];
                }
            }

            if (result.isFinal) {
                [strongSelf.silenceTimer invalidate];
                strongSelf.silenceTimer = nil;
                NSString *finalText = [strongSelf.lastEmittedInterim stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
                if (finalText.length > 0) {
                    [strongSelf emitJSON:@{
                        @"type": @"final",
                        @"text": finalText
                    }];
                    strongSelf.lastEmittedInterim = @"";
                }
                [strongSelf refreshTaskCleanly];
            }
        }

        if (taskError && strongSelf.isRunning && !strongSelf.isTransitioning) {
            // Error code 216 is normal cancellation when stopping or refreshing
            if (taskError.code != 216) {
                NSString *finalText = [strongSelf.lastEmittedInterim stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
                if (finalText.length > 0) {
                    [strongSelf emitJSON:@{
                        @"type": @"final",
                        @"text": finalText
                    }];
                    strongSelf.lastEmittedInterim = @"";
                }
                [strongSelf refreshTaskCleanly];
            }
        }
    }];

    self.isTransitioning = NO;
}

- (void)refreshTaskCleanly {
    if (!self.isRunning || self.isTransitioning) return;
    self.isTransitioning = YES;
    dispatch_async(dispatch_get_main_queue(), ^{
        [self startNewRecognitionTask];
    });
}

- (void)stop {
    self.isRunning = NO;
    [self.silenceTimer invalidate];
    self.silenceTimer = nil;

    @synchronized (self) {
        if (self.currentRequest) {
            [self.currentRequest endAudio];
            self.currentRequest = nil;
        }
        [self.pendingBuffers removeAllObjects];
    }

    if (self.currentTask) {
        SFSpeechRecognitionTask *t = self.currentTask;
        self.currentTask = nil;
        [t cancel];
    }

    if (self.audioEngine.isRunning) {
        [self.audioEngine.inputNode removeTapOnBus:0];
        [self.audioEngine stop];
    }

    [self emitJSON:@{@"type": @"status", @"message": @"stopped"}];
    CFRunLoopStop(CFRunLoopGetMain());
}

@end

void sigHandler(int sig) {
    if (globalEngine) {
        [globalEngine stop];
    } else {
        exit(0);
    }
}

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        signal(SIGTERM, sigHandler);
        signal(SIGINT, sigHandler);

        globalEngine = [[StealthSpeechEngine alloc] init];
        [globalEngine start];

        // Read commands from stdin without exiting on EOF
        dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
            char buffer[256];
            while (fgets(buffer, sizeof(buffer), stdin) != NULL) {
                NSString *input = [NSString stringWithUTF8String:buffer];
                if ([input hasPrefix:@"stop"] || [input hasPrefix:@"quit"]) {
                    dispatch_async(dispatch_get_main_queue(), ^{
                        [globalEngine stop];
                    });
                    break;
                }
            }
        });

        // Run Cocoa main runloop persistently
        CFRunLoopRun();
    }
    return 0;
}
