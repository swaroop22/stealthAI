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
@property (nonatomic, assign) uint64_t currentTaskId;
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
        self.currentTaskId = 0;
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

    [self emitJSON:@{@"type": @"status", @"message": @"starting"}];

    // Explicitly verify microphone and speech recognition authorization
    [AVCaptureDevice requestAccessForMediaType:AVMediaTypeAudio completionHandler:^(BOOL micGranted) {
        if (!micGranted) {
            dispatch_async(dispatch_get_main_queue(), ^{
                [self emitJSON:@{
                    @"type": @"error",
                    @"message": @"Microphone access denied. Please grant microphone access in macOS System Settings > Privacy & Security > Microphone."
                }];
            });
            return;
        }

        [SFSpeechRecognizer requestAuthorization:^(SFSpeechRecognizerAuthorizationStatus status) {
            dispatch_async(dispatch_get_main_queue(), ^{
                if (status == SFSpeechRecognizerAuthorizationStatusAuthorized) {
                    self.isRunning = YES;
                    [self setupAndStartAudio];
                } else {
                    [self emitJSON:@{
                        @"type": @"error",
                        @"message": @"Speech Recognition denied. Please allow Speech Recognition in macOS System Settings > Privacy & Security > Speech Recognition."
                    }];
                }
            });
        }];
    }];
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
                    // Buffer incoming audio during brief task rollover so 0 samples are dropped
                    if (strongSelf.pendingBuffers.count < 100) {
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

    // Increment task identifier so all callbacks from older tasks are immediately discarded
    uint64_t thisTaskId = ++self.currentTaskId;

    [self.silenceTimer invalidate];
    self.silenceTimer = nil;

    // Clean up old task safely
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

    // Allow on-device with graceful system fallback
    if (@available(macOS 10.15, *)) {
        newRequest.requiresOnDeviceRecognition = NO;
    }

    if (@available(macOS 13.0, *)) {
        newRequest.addsPunctuation = YES;
    }

    // Contextual tech interview vocabulary
    newRequest.contextualStrings = @[
        @"API", @"HTTP", @"HTTPS", @"TCP", @"UDP", @"DNS", @"Postgres", @"PostgreSQL",
        @"Redis", @"Kafka", @"Docker", @"Kubernetes", @"AWS", @"GCP", @"Azure",
        @"microservices", @"architecture", @"concurrency", @"multithreading",
        @"cache", @"latency", @"throughput", @"database", @"SQL", @"NoSQL",
        @"React", @"TypeScript", @"JavaScript", @"Python", @"golang", @"GraphQL",
        @"load balancer", @"sharding", @"replication", @"hash map", @"binary tree",
        @"BigQuery", @"Snowflake", @"Databricks", @"PySpark", @"Apache Spark", @"dbt"
    ];

    @synchronized (self) {
        self.currentRequest = newRequest;
        // Inject any audio buffered during this ~10ms task swap
        for (AVAudioPCMBuffer *buf in self.pendingBuffers) {
            [newRequest appendAudioPCMBuffer:buf];
        }
        [self.pendingBuffers removeAllObjects];
    }

    __weak typeof(self) weakSelf = self;
    self.currentTask = [self.recognizer recognitionTaskWithRequest:newRequest resultHandler:^(SFSpeechRecognitionResult * _Nullable result, NSError * _Nullable taskError) {
        dispatch_async(dispatch_get_main_queue(), ^{
            __strong typeof(weakSelf) strongSelf = weakSelf;
            if (!strongSelf || !strongSelf.isRunning) return;

            // Reject any events from previous tasks
            if (strongSelf.currentTaskId != thisTaskId) {
                return;
            }

            if (result) {
                NSString *fullTranscript = result.bestTranscription.formattedString;
                if (fullTranscript.length > 0) {
                    NSString *turnText = [fullTranscript stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];

                    if (turnText.length > 0) {
                        strongSelf.lastEmittedInterim = turnText;
                        [strongSelf emitJSON:@{
                            @"type": @"interim",
                            @"text": turnText
                        }];

                        // Continuous speaking guard: If user talks unbroken for > 20s, commit and refresh
                        NSTimeInterval elapsed = [[NSDate date] timeIntervalSinceDate:strongSelf.taskStartTime];
                        if (elapsed >= 20.0) {
                            [strongSelf emitJSON:@{
                                @"type": @"final",
                                @"text": turnText
                            }];
                            strongSelf.lastEmittedInterim = @"";
                            [strongSelf refreshTaskCleanly];
                            return;
                        }

                        // Natural conversational pause: finalize turn after 1.2s of silence
                        [strongSelf.silenceTimer invalidate];
                        strongSelf.silenceTimer = [NSTimer scheduledTimerWithTimeInterval:1.2 repeats:NO block:^(NSTimer * _Nonnull timer) {
                            __strong typeof(weakSelf) sSelf = weakSelf;
                            if (!sSelf || !sSelf.isRunning || sSelf.currentTaskId != thisTaskId) return;

                            NSString *finalText = [sSelf.lastEmittedInterim stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
                            if (finalText.length > 0) {
                                [sSelf emitJSON:@{
                                    @"type": @"final",
                                    @"text": finalText
                                }];
                                sSelf.lastEmittedInterim = @"";
                            }

                            // Refresh task cleanly between utterances to guarantee infinite continuous listening
                            [sSelf refreshTaskCleanly];
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

            // Real error from the current active task (ignoring normal cancel error 216)
            if (taskError && strongSelf.isRunning && strongSelf.currentTaskId == thisTaskId) {
                if (taskError.code != 216) {
                    NSString *finalText = [strongSelf.lastEmittedInterim stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
                    if (finalText.length > 0) {
                        [strongSelf emitJSON:@{
                            @"type": @"final",
                            @"text": finalText
                        }];
                        strongSelf.lastEmittedInterim = @"";
                    }
                    // Auto-recover after unexpected error
                    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(400 * NSEC_PER_MSEC)), dispatch_get_main_queue(), ^{
                        if (strongSelf.isRunning && strongSelf.currentTaskId == thisTaskId) {
                            [strongSelf refreshTaskCleanly];
                        }
                    });
                }
            }
        });
    }];
}

- (void)refreshTaskCleanly {
    if (!self.isRunning) return;

    [self.silenceTimer invalidate];
    self.silenceTimer = nil;

    [self startNewRecognitionTask];
}

- (void)stop {
    self.isRunning = NO;
    self.currentTaskId++;

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
